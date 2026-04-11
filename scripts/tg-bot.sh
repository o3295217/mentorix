#!/usr/bin/env bash
# =============================================================================
# AI Assistant — Telegram Bot (polling)
# Слушает команды и нажатия кнопок из Telegram
# Отвечает понятным русским языком
# Запускается как systemd-сервис: tg-bot.service
# =============================================================================

TG_ENV_FILE="/home/ubuntu/.tg-bot-env"
TG_TOKEN_FILE="${TG_BOT_TOKEN_FILE:-/home/ubuntu/.tg-bot-token}"
CONTAINER="ai-assistant-production"
APP_DIR="/home/ubuntu/ai-assistant-spec"
LOG_DIR="$APP_DIR/logs/monitor"
OFFSET_FILE="$LOG_DIR/.tg_offset"

if [ -f "$TG_ENV_FILE" ]; then
  . "$TG_ENV_FILE"
fi

if [ -z "${TG_BOT_TOKEN:-}" ] && [ -r "$TG_TOKEN_FILE" ]; then
  TG_BOT_TOKEN=$(cat "$TG_TOKEN_FILE")
fi

if [ -z "${TG_BOT_TOKEN:-}" ] || [ -z "${TG_CHAT_ID:-}" ]; then
  echo "TG_BOT_TOKEN and TG_CHAT_ID must be configured" >&2
  exit 1
fi

# Cloudflare Worker прокси для Telegram API (обход блокировки VK Cloud)
TG_API_BASE="${TG_API_BASE:-https://tg-proxy.o3295217.workers.dev}"

mkdir -p "$LOG_DIR"

# Безопасность: отвечаем только владельцу
is_owner() {
  [ "$1" = "$TG_CHAT_ID" ]
}

# Отправить текстовое сообщение
send() {
  curl -s -X POST "${TG_API_BASE}/bot${TG_BOT_TOKEN}/sendMessage" \
    -H "x-tg-proxy-secret: ${TG_PROXY_SECRET}" \
    --data-urlencode "chat_id=$TG_CHAT_ID" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=$1" > /dev/null 2>&1
}

# Отправить сообщение с кнопками (inline keyboard)
send_with_buttons() {
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
    }" > /dev/null 2>&1
}

# Ответить на callback_query (убрать «часики» с кнопки)
answer_callback() {
  curl -s -X POST "${TG_API_BASE}/bot${TG_BOT_TOKEN}/answerCallbackQuery" \
    -H "x-tg-proxy-secret: ${TG_PROXY_SECRET}" \
    -d "callback_query_id=$1" > /dev/null 2>&1
}

get_offset() {
  cat "$OFFSET_FILE" 2>/dev/null || echo "0"
}

save_offset() {
  echo "$1" > "$OFFSET_FILE"
}

# Главное меню — кнопки
MAIN_KEYBOARD='{
  "inline_keyboard": [
    [{"text": "📊 Состояние сервера", "callback_data": "status"}],
    [{"text": "🛡 Проверка безопасности", "callback_data": "check"}],
    [{"text": "⚠️ Алерты за сегодня", "callback_data": "alerts"}],
    [{"text": "👥 Пользователи", "callback_data": "users"}, {"text": "🌐 IP-адреса", "callback_data": "ips"}]
  ]
}'

# ---- Обработчики команд ----

cmd_status() {
  # Приложение
  APP_RAW=$(docker ps --format "{{.Status}}" --filter "name=$CONTAINER" 2>/dev/null)
  if [ -z "$APP_RAW" ]; then
    APP_LINE="❌ Приложение не запущено!"
  else
    APP_LINE="✅ Приложение работает ($(echo "$APP_RAW" | sed 's/Up /аптайм: /'))"
  fi

  # База данных
  DB_RAW=$(docker ps --format "{{.Status}}" --filter "name=ai-assistant-db" 2>/dev/null)
  if [ -z "$DB_RAW" ]; then
    DB_LINE="❌ База данных не запущена!"
  else
    DB_LINE="✅ База данных работает ($(echo "$DB_RAW" | sed 's/Up /аптайм: /'))"
  fi

  # Доступность сайта
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "ERR")
  if [ "$HEALTH" = "200" ]; then
    HEALTH_LINE="✅ Сайт доступен"
  else
    HEALTH_LINE="❌ Сайт недоступен (код: $HEALTH)"
  fi

  # Нагрузка
  CPU_PCT=$(docker stats "$CONTAINER" --no-stream --format "{{.CPUPerc}}" 2>/dev/null || echo "?")
  MEM_RAW=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "?")
  
  CPU_NUM=$(echo "$CPU_PCT" | tr -d '%')
  if [ "$(echo "$CPU_NUM > 50" | bc 2>/dev/null)" = "1" ]; then
    CPU_ICON="🔴"
  elif [ "$(echo "$CPU_NUM > 20" | bc 2>/dev/null)" = "1" ]; then
    CPU_ICON="🟡"
  else
    CPU_ICON="🟢"
  fi

  # Диск
  DISK_PCT=$(df / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%')
  DISK_USED=$(df -h / 2>/dev/null | awk 'NR==2{print $3}')
  DISK_TOTAL=$(df -h / 2>/dev/null | awk 'NR==2{print $2}')
  if [ "$DISK_PCT" -gt 85 ] 2>/dev/null; then
    DISK_ICON="🔴"
  elif [ "$DISK_PCT" -gt 70 ] 2>/dev/null; then
    DISK_ICON="🟡"
  else
    DISK_ICON="🟢"
  fi

  # RAM хоста
  HOST_MEM_USED=$(free -m 2>/dev/null | awk '/Mem:/{print $3}')
  HOST_MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/{print $2}')
  HOST_MEM_PCT=$((HOST_MEM_USED * 100 / HOST_MEM_TOTAL)) 2>/dev/null
  if [ "$HOST_MEM_PCT" -gt 85 ] 2>/dev/null; then
    MEM_ICON="🔴"
  elif [ "$HOST_MEM_PCT" -gt 60 ] 2>/dev/null; then
    MEM_ICON="🟡"
  else
    MEM_ICON="🟢"
  fi

  # Безопасность (кратко)
  UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1)
  if echo "$UFW_STATUS" | grep -q "active"; then
    FW_LINE="✅ Файрвол включён"
  else
    FW_LINE="❌ Файрвол выключен!"
  fi

  PORT_BIND=$(ss -tlnp 2>/dev/null | grep ':3000' | awk '{print $4}')
  if echo "$PORT_BIND" | grep -q "127.0.0.1"; then
    PORT_LINE="✅ Порт закрыт снаружи"
  else
    PORT_LINE="❌ Порт 3000 открыт наружу!"
  fi

  send_with_buttons "📊 <b>Состояние сервера</b>

<b>Сервисы:</b>
$APP_LINE
$DB_LINE
$HEALTH_LINE

<b>Нагрузка:</b>
$CPU_ICON Процессор: $CPU_PCT
$MEM_ICON Память хоста: ${HOST_MEM_USED}/${HOST_MEM_TOTAL} МБ (${HOST_MEM_PCT}%)
$DISK_ICON Диск: ${DISK_USED}/${DISK_TOTAL} (${DISK_PCT}%)
    Память приложения: $MEM_RAW

<b>Защита:</b>
$FW_LINE
$PORT_LINE" "$MAIN_KEYBOARD"
}

cmd_alerts() {
  TODAY=$(date -u +%Y-%m-%d)
  ALERTS=$(grep "\[$TODAY" "$LOG_DIR/alerts.log" 2>/dev/null | tail -10 || true)

  if [ -z "$ALERTS" ]; then
    send_with_buttons "✅ <b>Алерты за сегодня</b>

Всё спокойно, проблем не обнаружено.
Мониторинг проверяет сервер каждые 30 минут." "$MAIN_KEYBOARD"
  else
    COUNT=$(echo "$ALERTS" | wc -l | tr -d ' ')
    # Форматируем алерты в читаемом виде
    FORMATTED=$(echo "$ALERTS" | sed 's/\[.*\] ALERT: /⚠️ /' | head -5)
    send_with_buttons "🚨 <b>Алерты за сегодня: $COUNT</b>

$FORMATTED" "$MAIN_KEYBOARD"
  fi
}

cmd_users() {
  USERS=$(docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -t -c \
    "SELECT name || ' — ' || email || ' ' || CASE WHEN \"emailVerified\" THEN '✅' ELSE '⏳' END || ' (рег. ' || \"createdAt\"::date || ')' FROM users ORDER BY \"createdAt\";" 2>/dev/null || echo "Ошибка подключения к базе")
  COUNT=$(docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -t -c \
    "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "?")

  # Trim whitespace
  USERS=$(echo "$USERS" | sed 's/^ *//')

  send_with_buttons "👥 <b>Пользователи ($COUNT)</b>

$USERS

✅ = почта подтверждена
⏳ = ожидает подтверждения" "$MAIN_KEYBOARD"
}

cmd_ips() {
  IPS=$(cat "$LOG_DIR/known_ips.txt" 2>/dev/null || echo "Файл не найден")

  send_with_buttons "🌐 <b>Зафиксированные SSH-входы</b>

Эти IP-адреса использовались для входа с вашим SSH-ключом:

<code>$IPS</code>

Новые IP автоматически записываются при входе." "$MAIN_KEYBOARD"
}

cmd_check() {
  send "🔄 <b>Запускаю полную проверку безопасности...</b>

Это займёт несколько секунд."

  sudo /bin/sh "$APP_DIR/scripts/monitor.sh" > /dev/null 2>&1

  NEW_ALERTS=$(grep "\[$(date '+%Y-%m-%d %H:%M')" "$LOG_DIR/alerts.log" 2>/dev/null | tail -5 || true)

  # Собираем данные аудита из БД
  AUDIT_DATA=$(docker exec "$CONTAINER" node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    const h24 = new Date(Date.now() - 24*60*60*1000).toISOString();
    Promise.all([
      p.\$queryRawUnsafe(\"SELECT action, COUNT(*)::int as cnt FROM audit_logs WHERE \\\"createdAt\\\" >= '\" + h24 + \"' GROUP BY action ORDER BY cnt DESC\"),
      p.\$queryRawUnsafe(\"SELECT COUNT(DISTINCT \\\"ipAddress\\\")::int as cnt FROM audit_logs WHERE \\\"createdAt\\\" >= '\" + h24 + \"' AND \\\"ipAddress\\\" IS NOT NULL\"),
      p.\$queryRawUnsafe(\"SELECT COUNT(*)::int as cnt FROM sessions WHERE \\\"expiresAt\\\" > NOW()\"),
      p.\$queryRawUnsafe(\"SELECT \\\"ipAddress\\\", MAX(\\\"createdAt\\\") as t FROM audit_logs WHERE action='login' AND \\\"createdAt\\\" >= '\" + h24 + \"' GROUP BY \\\"ipAddress\\\"\"),
    ]).then(([actions, [ips], [sessions], loginIps]) => {
      const r = {};
      r.actions = actions.map(a => a.action + ': ' + a.cnt).join(', ') || 'нет';
      r.ips = ips.cnt;
      r.sessions = sessions.cnt;
      r.loginIps = loginIps.map(l => l.ipAddress).join(', ') || 'нет';
      r.failedCount = (actions.find(a => a.action === 'login_failed') || {}).cnt || 0;
      console.log(JSON.stringify(r));
      p.\$disconnect();
    }).catch(() => { console.log('{}'); });
  " 2>&1 || echo "{}")

  AUDIT_ACTIONS=$(echo "$AUDIT_DATA" | jq -r '.actions // "нет данных"' 2>/dev/null || echo "нет данных")
  AUDIT_IPS=$(echo "$AUDIT_DATA" | jq -r '.ips // 0' 2>/dev/null || echo "?")
  AUDIT_SESSIONS=$(echo "$AUDIT_DATA" | jq -r '.sessions // 0' 2>/dev/null || echo "?")
  AUDIT_LOGIN_IPS=$(echo "$AUDIT_DATA" | jq -r '.loginIps // "нет"' 2>/dev/null || echo "нет")
  AUDIT_FAILED=$(echo "$AUDIT_DATA" | jq -r '.failedCount // 0' 2>/dev/null || echo "0")

  if [ "$AUDIT_FAILED" -gt 0 ] 2>/dev/null; then
    FAILED_ICON="⚠️"
  else
    FAILED_ICON="✅"
  fi

  if [ -z "$NEW_ALERTS" ]; then
    send_with_buttons "✅ <b>Проверка завершена</b>

<b>Инфраструктура:</b>
• Процессы контейнера в норме
• Подозрительных файлов нет
• Сайт доступен
• Нагрузка в пределах нормы
• Файрвол активен
• Порты защищены
• SSH-входы только от владельца

<b>Аудит (24ч):</b>
$FAILED_ICON Неудачных входов: $AUDIT_FAILED
🔑 Активных сессий: $AUDIT_SESSIONS
🌐 Уник. IP: $AUDIT_IPS ($AUDIT_LOGIN_IPS)
📋 События: $AUDIT_ACTIONS" "$MAIN_KEYBOARD"
  else
    FORMATTED=$(echo "$NEW_ALERTS" | sed 's/\[.*\] ALERT: /🚨 /')
    send_with_buttons "🚨 <b>Проверка завершена — найдены проблемы:</b>

$FORMATTED

<b>Аудит (24ч):</b>
$FAILED_ICON Неудачных входов: $AUDIT_FAILED
🔑 Активных сессий: $AUDIT_SESSIONS
🌐 Уник. IP: $AUDIT_IPS ($AUDIT_LOGIN_IPS)
📋 События: $AUDIT_ACTIONS" "$MAIN_KEYBOARD"
  fi
}

cmd_menu() {
  send_with_buttons "🤖 <b>AI Assistant — Мониторинг</b>

Выберите действие:" "$MAIN_KEYBOARD"
}

# ---- Действия по алертам (подтверждение через кнопки) ----

# 🔄 Перезапустить контейнер (при health fail / high CPU / container down)
act_restart() {
  send "🔄 <b>Перезапуск контейнера...</b>"
  
  cd "$APP_DIR"
  docker compose -f docker-compose.production.yml --env-file .env.production restart app 2>&1
  RESULT=$?
  
  sleep 5
  
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "ERR")
  
  if [ "$HEALTH" = "200" ]; then
    send_with_buttons "✅ <b>Контейнер перезапущен</b>

Сайт доступен (Health: 200).
Время: $(date '+%H:%M:%S')" "$MAIN_KEYBOARD"
  else
    send_with_buttons "⚠️ <b>Контейнер перезапущен, но сайт недоступен</b>

Health: $HEALTH

Возможно нужна ручная проверка." "$MAIN_KEYBOARD"
  fi
}

# 🧹 Очистить диск (при disk > 85%)
act_cleanup() {
  send "🧹 <b>Очистка диска...</b>"
  
  # Удаляем неиспользуемые Docker образы, контейнеры, volumes
  DOCKER_FREED=$(docker system prune -f 2>&1 | tail -1 || echo "N/A")
  
  # Удаляем логи мониторинга старше 7 дней
  OLD_LOGS=$(find "$LOG_DIR" -name "*.log" -mtime +7 -type f 2>/dev/null | wc -l)
  find "$LOG_DIR" -name "*.log" -mtime +7 -type f -delete 2>/dev/null || true
  
  # Ротация логов Docker контейнера
  docker logs "$CONTAINER" --since 72h > /dev/null 2>&1
  
  # Итоговый размер диска
  DISK_AFTER=$(df -h / | awk 'NR==2{print $5 " (" $3 "/" $2 ")"}')
  
  send_with_buttons "✅ <b>Очистка завершена</b>

Docker: $DOCKER_FREED
Старых логов удалено: $OLD_LOGS
Диск сейчас: $DISK_AFTER" "$MAIN_KEYBOARD"
}

# 🛑 Остановить и пересобрать (при обнаружении малвари)
act_kill() {
  send "🛑 <b>Экстренная остановка контейнера...</b>

⚠️ Контейнер будет остановлен, удалён и пересобран с нуля."

  cd "$APP_DIR"
  
  # Стоп и удаление
  docker compose -f docker-compose.production.yml --env-file .env.production stop app 2>&1
  docker compose -f docker-compose.production.yml --env-file .env.production rm -f app 2>&1
  
  # Пересборка без кэша
  docker compose -f docker-compose.production.yml --env-file .env.production build --no-cache app 2>&1
  
  # Запуск
  docker compose -f docker-compose.production.yml --env-file .env.production up -d app 2>&1
  
  sleep 10
  
  HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "ERR")
  PROCS=$(docker exec "$CONTAINER" ps aux 2>/dev/null | wc -l || echo "?")
  
  if [ "$HEALTH" = "200" ]; then
    send_with_buttons "✅ <b>Контейнер пересобран и запущен</b>

Health: $HEALTH
Процессов: $PROCS

⚠️ Рекомендуется проверить хост вручную." "$MAIN_KEYBOARD"
  else
    send_with_buttons "❌ <b>Проблемы после пересборки</b>

Health: $HEALTH
Процессов: $PROCS

Требуется ручное вмешательство!" "$MAIN_KEYBOARD"
  fi
}

# Игнорировать алерт
act_dismiss() {
  send_with_buttons "👌 <b>Алерт проигнорирован</b>" "$MAIN_KEYBOARD"
}

# ---- Главный цикл ----

echo "$(date) Бот запущен, ожидание команд..."

while true; do
  OFFSET=$(get_offset)

  RESPONSE=$(curl -s -H "x-tg-proxy-secret: ${TG_PROXY_SECRET}" "${TG_API_BASE}/bot${TG_BOT_TOKEN}/getUpdates?offset=$OFFSET&timeout=30" 2>/dev/null)

  if [ -z "$RESPONSE" ]; then
    sleep 5
    continue
  fi

  # Количество обновлений
  UCOUNT=$(echo "$RESPONSE" | jq '.result | length' 2>/dev/null)
  if [ -z "$UCOUNT" ] || [ "$UCOUNT" = "0" ]; then
    continue
  fi

  # Обрабатываем каждое обновление
  INDEX=0
  while [ "$INDEX" -lt "$UCOUNT" ]; do
    UPDATE_ID=$(echo "$RESPONSE" | jq -r ".result[$INDEX].update_id" 2>/dev/null)

    # Пропускаем если update_id невалидный
    if [ -z "$UPDATE_ID" ] || [ "$UPDATE_ID" = "null" ]; then
      INDEX=$((INDEX + 1))
      continue
    fi

    # Определяем тип: сообщение или нажатие кнопки
    MSG_CHAT=$(echo "$RESPONSE" | jq -r ".result[$INDEX].message.chat.id // empty" 2>/dev/null)
    MSG_TEXT=$(echo "$RESPONSE" | jq -r ".result[$INDEX].message.text // empty" 2>/dev/null)
    CB_CHAT=$(echo "$RESPONSE" | jq -r ".result[$INDEX].callback_query.message.chat.id // empty" 2>/dev/null)
    CB_DATA=$(echo "$RESPONSE" | jq -r ".result[$INDEX].callback_query.data // empty" 2>/dev/null)
    CB_ID=$(echo "$RESPONSE" | jq -r ".result[$INDEX].callback_query.id // empty" 2>/dev/null)

    # Сохраняем offset
    NEW_OFFSET=$((UPDATE_ID + 1))
    save_offset "$NEW_OFFSET"
    INDEX=$((INDEX + 1))

    # === Обработка нажатия кнопки ===
    if [ -n "$CB_DATA" ] && [ -n "$CB_CHAT" ]; then
      answer_callback "$CB_ID"

      if ! is_owner "$CB_CHAT"; then
        continue
      fi

      echo "$(date) Кнопка: $CB_DATA от $CB_CHAT"

      case "$CB_DATA" in
        status)      cmd_status ;;
        check)       cmd_check ;;
        alerts)      cmd_alerts ;;
        users)       cmd_users ;;
        ips)         cmd_ips ;;
        act_restart) act_restart ;;
        act_cleanup) act_cleanup ;;
        act_kill)    act_kill ;;
        dismiss)     act_dismiss ;;
      esac
      continue
    fi

    # === Обработка текстового сообщения ===
    if [ -n "$MSG_TEXT" ] && [ -n "$MSG_CHAT" ]; then
      if ! is_owner "$MSG_CHAT"; then
        continue
      fi

      CMD=$(echo "$MSG_TEXT" | sed 's/@.*//')
      echo "$(date) Команда: $CMD от $MSG_CHAT"

      case "$CMD" in
        /start|/help|/menu) cmd_menu ;;
        /status)            cmd_status ;;
        /alerts)            cmd_alerts ;;
        /users)             cmd_users ;;
        /ips)               cmd_ips ;;
        /check)             cmd_check ;;
        *)                  cmd_menu ;;
      esac
    fi
  done
done
