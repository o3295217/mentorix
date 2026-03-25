#!/bin/sh
# =============================================================================
# AI Assistant — Telegram Bot (polling)
# Слушает команды из Telegram и отвечает состоянием сервера
# Запускается как фоновый сервис: systemd или nohup
# =============================================================================

TG_BOT_TOKEN="8008848660:AAHZy9dyuVAtHyiv498TZ4rNRMvBHL8cGzo"
TG_CHAT_ID="200374835"
CONTAINER="ai-assistant-production"
APP_DIR="/home/ubuntu/ai-assistant-spec"
LOG_DIR="$APP_DIR/logs/monitor"
OFFSET_FILE="$LOG_DIR/.tg_offset"

# Security: only respond to owner
is_owner() {
  [ "$1" = "$TG_CHAT_ID" ]
}

send() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -d chat_id="$TG_CHAT_ID" \
    -d parse_mode="HTML" \
    -d text="$1" > /dev/null 2>&1
}

get_offset() {
  cat "$OFFSET_FILE" 2>/dev/null || echo "0"
}

save_offset() {
  echo "$1" > "$OFFSET_FILE"
}

# ---- Command handlers ----

cmd_status() {
  APP_STATUS=$(docker ps --format "{{.Status}}" --filter "name=$CONTAINER" 2>/dev/null || echo "NOT RUNNING")
  DB_STATUS=$(docker ps --format "{{.Status}}" --filter "name=ai-assistant-db" 2>/dev/null || echo "NOT RUNNING")
  
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "ERR")
  
  CPU_PCT=$(docker stats "$CONTAINER" --no-stream --format "{{.CPUPerc}}" 2>/dev/null || echo "N/A")
  MEM=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "N/A")
  
  HOST_DISK=$(df -h / 2>/dev/null | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}' || echo "N/A")
  HOST_MEM=$(free -m 2>/dev/null | awk '/Mem:/{printf "%dMB/%dMB (%.0f%%)", $3, $2, $3/$2*100}' || echo "N/A")
  
  UFW=$(sudo ufw status 2>/dev/null | head -1 || echo "N/A")
  PORT=$(ss -tlnp 2>/dev/null | grep ':3000' | awk '{print $4}' || echo "N/A")
  
  PROCS=$(docker exec "$CONTAINER" ps aux 2>/dev/null | wc -l || echo "?")
  TMP_FILES=$(docker exec "$CONTAINER" ls /tmp/ 2>/dev/null | wc -l || echo "?")

  send "📊 <b>Статус сервера</b>

🐳 App: $APP_STATUS
🐘 DB: $DB_STATUS
🌐 Health: $HEALTH
⚡ CPU: $CPU_PCT | RAM: $MEM

💻 <b>Хост:</b>
Диск: $HOST_DISK
RAM: $HOST_MEM
Firewall: $UFW
Port 3000: $PORT

🔒 <b>Безопасность:</b>
Процессов: $PROCS | /tmp: $TMP_FILES файлов"
}

cmd_alerts() {
  TODAY=$(date -u +%Y-%m-%d)
  ALERTS=$(grep "\[$TODAY" "$LOG_DIR/alerts.log" 2>/dev/null | tail -10 || true)
  
  if [ -z "$ALERTS" ]; then
    send "✅ <b>Алерты за сегодня:</b> нет"
  else
    # Truncate if too long for Telegram (4096 chars limit)
    SHORT=$(echo "$ALERTS" | head -5 | cut -c1-200)
    COUNT=$(echo "$ALERTS" | wc -l | tr -d ' ')
    send "⚠️ <b>Алерты за сегодня ($COUNT):</b>

<code>$SHORT</code>"
  fi
}

cmd_users() {
  USERS=$(docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -t -c \
    "SELECT name || ' | ' || email || ' | ' || CASE WHEN \"emailVerified\" THEN '✅' ELSE '❌' END || ' | ' || \"createdAt\"::date FROM users ORDER BY \"createdAt\";" 2>/dev/null || echo "DB error")
  COUNT=$(docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -t -c \
    "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "?")
  
  send "👥 <b>Пользователи ($COUNT):</b>

<code>$USERS</code>"
}

cmd_ips() {
  IPS=$(cat "$LOG_DIR/known_ips.txt" 2>/dev/null || echo "Файл не найден")
  send "🌐 <b>Зафиксированные IP:</b>

<code>$IPS</code>"
}

cmd_check() {
  send "🔄 Запускаю полную проверку..."
  OUTPUT=$(sudo /bin/sh "$APP_DIR/scripts/monitor.sh" 2>&1 | tail -5)
  
  TODAY=$(date -u +%Y-%m-%d)
  NEW_ALERTS=$(grep "\[$(date '+%Y-%m-%d %H:%M')" "$LOG_DIR/alerts.log" 2>/dev/null | tail -5 || true)
  
  if [ -z "$NEW_ALERTS" ]; then
    send "✅ <b>Проверка завершена</b> — проблем не обнаружено"
  else
    send "🚨 <b>Проверка завершена — есть алерты:</b>

<code>$NEW_ALERTS</code>"
  fi
}

cmd_help() {
  send "🤖 <b>AI Assistant Monitor</b>

/status — статус сервера
/alerts — алерты за сегодня  
/users — список пользователей
/ips — зафиксированные IP
/check — запустить полную проверку
/help — эта справка"
}

# ---- Main polling loop ----

echo "$(date) Bot started, polling for commands..."

while true; do
  OFFSET=$(get_offset)
  
  RESPONSE=$(curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/getUpdates?offset=$OFFSET&timeout=30" 2>/dev/null)
  
  if [ -z "$RESPONSE" ]; then
    sleep 5
    continue
  fi
  
  # Parse updates using simple grep/sed (no jq dependency)
  UPDATES=$(echo "$RESPONSE" | grep -o '"update_id":[0-9]*' | grep -o '[0-9]*')
  
  for UPDATE_ID in $UPDATES; do
    # Extract message text and chat_id for this update
    # Get the chunk of JSON around this update_id
    CHUNK=$(echo "$RESPONSE" | grep -o "\"update_id\":${UPDATE_ID}[^}]*\"text\":\"[^\"]*\"" || true)
    CHAT=$(echo "$RESPONSE" | grep -o "\"update_id\":${UPDATE_ID}[^]]*\"chat\":{\"id\":[0-9]*" | grep -o '"chat":{"id":[0-9]*' | grep -o '[0-9]*' || true)
    TEXT=$(echo "$CHUNK" | grep -o '"text":"[^"]*"' | head -1 | sed 's/"text":"//;s/"//' || true)
    
    # Save offset (update_id + 1)
    NEW_OFFSET=$((UPDATE_ID + 1))
    save_offset "$NEW_OFFSET"
    
    # Security: only owner
    if ! is_owner "$CHAT"; then
      continue
    fi
    
    # Route commands
    case "$TEXT" in
      /start|/help) cmd_help ;;
      /status)      cmd_status ;;
      /alerts)      cmd_alerts ;;
      /users)       cmd_users ;;
      /ips)         cmd_ips ;;
      /check)       cmd_check ;;
    esac
  done
done
