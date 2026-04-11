#!/bin/sh
# =============================================================================
# AI Assistant — мониторинг безопасности и здоровья
# Запускается каждые 30 минут через cron
# Логи: /home/ubuntu/ai-assistant-spec/logs/monitor/
# =============================================================================

set -e

APP_DIR="/home/ubuntu/ai-assistant-spec"
LOG_DIR="$APP_DIR/logs/monitor"
CONTAINER="ai-assistant-production"
ALERT_FILE="$LOG_DIR/alerts.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATE_TAG=$(date '+%Y-%m-%d')
LOG_FILE="$LOG_DIR/$DATE_TAG.log"
TG_ENV_FILE="/home/ubuntu/.tg-bot-env"
TG_TOKEN_FILE="${TG_BOT_TOKEN_FILE:-/home/ubuntu/.tg-bot-token}"

if [ -f "$TG_ENV_FILE" ]; then
  . "$TG_ENV_FILE"
fi

if [ -z "${TG_BOT_TOKEN:-}" ] && [ -r "$TG_TOKEN_FILE" ]; then
  TG_BOT_TOKEN=$(cat "$TG_TOKEN_FILE")
fi

TG_NOTIFICATIONS_ENABLED=true
if [ -z "${TG_BOT_TOKEN:-}" ] || [ -z "${TG_CHAT_ID:-}" ]; then
  TG_NOTIFICATIONS_ENABLED=false
fi

# Cloudflare Worker прокси для Telegram API
TG_API_BASE="${TG_API_BASE:-https://tg-proxy.o3295217.workers.dev}"

mkdir -p "$LOG_DIR"

log() {
  echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

tg_send() {
  [ "$TG_NOTIFICATIONS_ENABLED" = "true" ] || return 0
  curl -s -X POST "${TG_API_BASE}/bot${TG_BOT_TOKEN}/sendMessage" \
    -H "x-tg-proxy-secret: ${TG_PROXY_SECRET}" \
    --data-urlencode "chat_id=$TG_CHAT_ID" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=$1" > /dev/null 2>&1 || true
}

# Отправить алерт с кнопками действий
tg_send_action() {
  [ "$TG_NOTIFICATIONS_ENABLED" = "true" ] || return 0
  TEXT="$1"
  KEYBOARD="$2"
  curl -s -X POST "${TG_API_BASE}/bot${TG_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -H "x-tg-proxy-secret: ${TG_PROXY_SECRET}" \
    -d "{
      \"chat_id\": $TG_CHAT_ID,
      \"parse_mode\": \"HTML\",
      \"text\": $(echo "$TEXT" | jq -Rs .),
      \"reply_markup\": $KEYBOARD
    }" > /dev/null 2>&1 || true
}

alert() {
  echo "[$TIMESTAMP] ALERT: $1" >> "$ALERT_FILE"
  echo "[$TIMESTAMP] ALERT: $1" >> "$LOG_FILE"
  tg_send "🚨 <b>AI Assistant Alert</b>
$1
<i>$TIMESTAMP</i>"
}

# Алерт с кнопкой действия
alert_action() {
  MSG="$1"
  CALLBACK="$2"
  BTN_TEXT="$3"
  echo "[$TIMESTAMP] ALERT: $MSG" >> "$ALERT_FILE"
  echo "[$TIMESTAMP] ALERT: $MSG" >> "$LOG_FILE"
  KEYBOARD="{\"inline_keyboard\":[[{\"text\":\"$BTN_TEXT\",\"callback_data\":\"$CALLBACK\"},{\"text\":\"❌ Игнорировать\",\"callback_data\":\"dismiss\"}]]}"
  tg_send_action "🚨 <b>AI Assistant Alert</b>

$MSG

<i>$TIMESTAMP</i>" "$KEYBOARD"
}

log "===== Monitor run started ====="

if [ "$TG_NOTIFICATIONS_ENABLED" != "true" ]; then
  log "Telegram notifications disabled: missing TG_BOT_TOKEN or TG_CHAT_ID"
fi

# -----------------------------------------------------------------------------
# 1. Проверка процессов в контейнере (главный индикатор компрометации)
# -----------------------------------------------------------------------------
PROC_COUNT=$(docker exec "$CONTAINER" ps aux 2>/dev/null | wc -l)
PROC_LIST=$(docker exec "$CONTAINER" ps aux 2>/dev/null || echo "CONTAINER_DOWN")

if echo "$PROC_LIST" | grep -q "CONTAINER_DOWN"; then
  alert_action "❌ Контейнер <b>$CONTAINER</b> не запущен!" "act_restart" "🔄 Перезапустить контейнер"
elif [ "$PROC_COUNT" -gt 4 ]; then
  # Ожидаем: header + next-server + ps aux = 3 строки. 4 — с запасом.
  alert "Suspicious process count in container: $PROC_COUNT (expected <=4)"
  alert "Processes: $(echo "$PROC_LIST" | tail -n +2)"
fi

# Проверка на известные имена майнеров
if echo "$PROC_LIST" | grep -qiE 'xmrig|javae|kworker.*nextjs|kdevtmpfsi|cryptonight|minergate|stratum|pool\.|crypto'; then
  alert_action "☠️ КРИПТОМАЙНЕР обнаружен в контейнере!" "act_kill" "🛑 Остановить и пересобрать"
  alert "Processes: $PROC_LIST"
fi

log "Container processes: $PROC_COUNT lines"

# -----------------------------------------------------------------------------
# 2. Проверка /tmp/ в контейнере
# -----------------------------------------------------------------------------
TMP_FILES=$(docker exec "$CONTAINER" ls -la /tmp/ 2>/dev/null | tail -n +4 || echo "")
TMP_COUNT=$(echo "$TMP_FILES" | grep -c '[^ ]' 2>/dev/null || true)
TMP_COUNT=${TMP_COUNT:-0}

if [ "$TMP_COUNT" -gt 0 ] 2>/dev/null && [ -n "$TMP_FILES" ]; then
  alert "Files found in container /tmp/ ($TMP_COUNT files): $TMP_FILES"
fi

log "Container /tmp/ files: $TMP_COUNT"

# -----------------------------------------------------------------------------
# 3. Проверка здоровья приложения
# -----------------------------------------------------------------------------
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3000/api/health 2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  alert_action "🌐 Сайт недоступен! Health check: HTTP $HTTP_CODE" "act_restart" "🔄 Перезапустить контейнер"
else
  log "Health check: OK (200)"
fi

# -----------------------------------------------------------------------------
# 4. CPU и память контейнера
# -----------------------------------------------------------------------------
STATS=$(docker stats "$CONTAINER" --no-stream --format '{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null || echo "N/A")
CPU_PCT=$(echo "$STATS" | cut -f1 | tr -d '%')

if [ "$CPU_PCT" != "N/A" ] && [ -n "$CPU_PCT" ]; then
  CPU_INT=$(echo "$CPU_PCT" | cut -d'.' -f1)
  if [ "${CPU_INT:-0}" -gt 80 ] 2>/dev/null; then
    alert_action "⚡ Высокая нагрузка CPU: $CPU_PCT%" "act_restart" "🔄 Перезапустить контейнер"
  fi
fi

log "Container stats: CPU=$CPU_PCT% | $STATS"

# -----------------------------------------------------------------------------
# 5. CPU и память хоста
# -----------------------------------------------------------------------------
HOST_CPU=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' || echo "N/A")
HOST_MEM=$(free -m 2>/dev/null | awk '/Mem:/{printf "%d/%dMB (%.0f%%)", $3, $2, $3/$2*100}' || echo "N/A")
HOST_DISK=$(df -h / 2>/dev/null | awk 'NR==2{print $5 " used (" $3 "/" $2 ")"}' || echo "N/A")

DISK_PCT=$(df / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo "0")
if [ "${DISK_PCT:-0}" -gt 85 ] 2>/dev/null; then
  alert_action "💾 Диск заполнен на $DISK_PCT%!" "act_cleanup" "🧹 Очистить диск"
fi

log "Host: CPU=$HOST_CPU% | MEM=$HOST_MEM | DISK=$HOST_DISK"

# -----------------------------------------------------------------------------
# 6. Подозрительные процессы на хосте
# -----------------------------------------------------------------------------
SUSPICIOUS=$(ps aux 2>/dev/null | grep -iE 'xmrig|cryptonight|stratum|minergate|kdevtmpfsi' | grep -v grep || true)

if [ -n "$SUSPICIOUS" ]; then
  alert "SUSPICIOUS PROCESSES ON HOST: $SUSPICIOUS"
fi

# Процессы с аномально высоким CPU (>50%), исключая Docker, системные, healthcheck и саму команду ps
HOST_HIGH_CPU=$(ps aux --sort=-%cpu 2>/dev/null | awk 'NR>1 && $3>50 && $11!~/docker|containerd|sshd|systemd|telegraf|nginx|postgres|node|ps|awk|sort|grep|monitor/' | head -5 || true)

if [ -n "$HOST_HIGH_CPU" ]; then
  alert "High CPU processes on host: $HOST_HIGH_CPU"
fi

# -----------------------------------------------------------------------------
# 7. Firewall status
# -----------------------------------------------------------------------------
UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")

if ! echo "$UFW_STATUS" | grep -q "active"; then
  alert "FIREWALL IS NOT ACTIVE: $UFW_STATUS"
fi

log "Firewall: $UFW_STATUS"

# -----------------------------------------------------------------------------
# 8. Открытые порты (проверка что 3000 не на 0.0.0.0)
# -----------------------------------------------------------------------------
PORT_3000=$(ss -tlnp 2>/dev/null | grep ':3000' || echo "not listening")

if echo "$PORT_3000" | grep -q '0.0.0.0:3000'; then
  alert "Port 3000 is exposed on 0.0.0.0! Should be 127.0.0.1 only"
fi

log "Port 3000: $PORT_3000"

# -----------------------------------------------------------------------------
# 9. Docker security flags
# -----------------------------------------------------------------------------
READONLY=$(docker inspect "$CONTAINER" --format='{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "unknown")
SECOPT=$(docker inspect "$CONTAINER" --format='{{.HostConfig.SecurityOpt}}' 2>/dev/null || echo "unknown")

if [ "$READONLY" != "true" ]; then
  alert "Container filesystem is NOT read-only: $READONLY"
fi

log "Docker security: ReadOnly=$READONLY SecurityOpt=$SECOPT"

# -----------------------------------------------------------------------------
# 10. SSH — мониторинг входов по SSH-ключу
# Известный ключ владельца (IP может меняться из-за VPN)
# Новые IP с нашим ключом — записываем в known_ips.txt
# Входы с чужим ключом — алерт
# -----------------------------------------------------------------------------
KNOWN_IPS_FILE="$LOG_DIR/known_ips.txt"
OWNER_KEY="nfqLRtnaM5GFT75MGTi7zRTRY0Omqoqvl978E4qI5xU"

touch "$KNOWN_IPS_FILE"

# Все успешные SSH-входы из auth.log
SSH_LOGINS=$(grep 'Accepted publickey' /var/log/auth.log 2>/dev/null || true)

if [ -n "$SSH_LOGINS" ]; then
  # Входы с ЧУЖИМ ключом — алерт
  FOREIGN_KEY_SSH=$(echo "$SSH_LOGINS" | grep -v "$OWNER_KEY" | tail -5 || true)
  if [ -n "$FOREIGN_KEY_SSH" ]; then
    alert "SSH login with UNKNOWN KEY: $FOREIGN_KEY_SSH"
  fi

  # Входы с нашим ключом — собираем новые IP
  OUR_LOGINS=$(echo "$SSH_LOGINS" | grep "$OWNER_KEY" || true)
  if [ -n "$OUR_LOGINS" ]; then
    NEW_IPS=$(echo "$OUR_LOGINS" | grep -oE 'from [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | awk '{print $2}' | sort -u)
    for IP in $NEW_IPS; do
      if ! grep -qF "$IP" "$KNOWN_IPS_FILE" 2>/dev/null; then
        echo "[$TIMESTAMP] $IP" >> "$KNOWN_IPS_FILE"
        log "NEW owner IP recorded: $IP"
      fi
    done
  fi

  KNOWN_COUNT=$(wc -l < "$KNOWN_IPS_FILE" 2>/dev/null || echo "0")
  FOREIGN_COUNT=0
  if [ -n "$FOREIGN_KEY_SSH" ]; then
    FOREIGN_COUNT=$(echo "$FOREIGN_KEY_SSH" | wc -l | tr -d ' ')
  fi
  log "SSH: owner IPs known: $KNOWN_COUNT | foreign key logins: $FOREIGN_COUNT"
fi

# -----------------------------------------------------------------------------
# 11. Антропик — подсчёт запросов за последние 30 минут из логов контейнера
# -----------------------------------------------------------------------------
API_CALLS_30M=$(docker logs "$CONTAINER" --since 30m 2>&1 | grep -c '\[AI Usage\]' || true)
API_CALLS_30M=${API_CALLS_30M:-0}
log "Anthropic API calls (last 30min): $API_CALLS_30M"

if [ "${API_CALLS_30M:-0}" -gt 100 ] 2>/dev/null; then
  alert "Anomalous Anthropic API usage: $API_CALLS_30M calls in 30 minutes"
fi

# Уникальные endpoints
API_ENDPOINTS=$(docker logs "$CONTAINER" --since 30m 2>&1 | grep '\[AI Usage\]' | awk '{print $3}' | sort | uniq -c | sort -rn | head -5 || echo "none")
log "API endpoints breakdown: $API_ENDPOINTS"

# -----------------------------------------------------------------------------
# 12. Ежедневный аудит-дайджест (отправляется раз в сутки, в 08:00)
# -----------------------------------------------------------------------------
HOUR=$(date '+%H')
MINUTE=$(date '+%M')
DIGEST_SENT_FILE="$LOG_DIR/digest-sent-$DATE_TAG"

if [ "$HOUR" = "08" ] && [ ! -f "$DIGEST_SENT_FILE" ]; then
  YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d' 2>/dev/null || date -v-1d '+%Y-%m-%d' 2>/dev/null || echo "")

  if [ -n "$YESTERDAY" ]; then
    AUDIT_DIGEST=$(docker exec "$CONTAINER" node -e "
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      const since = new Date('${YESTERDAY}T00:00:00Z');
      const until = new Date('${DATE_TAG}T00:00:00Z');
      Promise.all([
        p.\$queryRawUnsafe(\"SELECT action, COUNT(*)::int as cnt FROM audit_logs WHERE \\\"createdAt\\\" >= '\"+since.toISOString()+\"' AND \\\"createdAt\\\" < '\"+until.toISOString()+\"' GROUP BY action ORDER BY cnt DESC\"),
        p.\$queryRawUnsafe(\"SELECT DISTINCT \\\"ipAddress\\\" FROM audit_logs WHERE \\\"createdAt\\\" >= '\"+since.toISOString()+\"' AND \\\"createdAt\\\" < '\"+until.toISOString()+\"' AND \\\"ipAddress\\\" IS NOT NULL\"),
        p.\$queryRawUnsafe(\"SELECT COUNT(*)::int as total FROM audit_logs WHERE \\\"createdAt\\\" >= '\"+since.toISOString()+\"' AND \\\"createdAt\\\" < '\"+until.toISOString()+\"'\")
      ]).then(([actions, ips, [total]]) => {
        const lines = [total.total + ' событий'];
        actions.forEach(a => lines.push(a.action + ': ' + a.cnt));
        lines.push('IP: ' + ips.map(i => i.ipAddress).join(', '));
        console.log(lines.join('\\n'));
        p.\$disconnect();
      }).catch(e => { console.error(e.message); p.\$disconnect(); });
    " 2>&1 || echo "Ошибка получения дайджеста")

    if [ -n "$AUDIT_DIGEST" ]; then
      tg_send "📊 <b>Аудит за $YESTERDAY</b>

$AUDIT_DIGEST"
      touch "$DIGEST_SENT_FILE"
      log "Daily audit digest sent"
    fi
  fi
fi

# Ротация digest-sent маркеров (хранить 7 дней)
find "$LOG_DIR" -name "digest-sent-*" -mtime +7 -delete 2>/dev/null || true

# -----------------------------------------------------------------------------
# 13. Ротация логов (хранить 30 дней)
# -----------------------------------------------------------------------------
find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true

log "===== Monitor run completed ====="

# Вывод алертов в stdout (для cron email)
if [ -f "$ALERT_FILE" ]; then
  TODAY_ALERTS=$(grep "^\[$TIMESTAMP" "$ALERT_FILE" 2>/dev/null || true)
  if [ -n "$TODAY_ALERTS" ]; then
    echo "$TODAY_ALERTS"
  fi
fi
