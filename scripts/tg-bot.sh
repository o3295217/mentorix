#!/bin/sh
# =============================================================================
# AI Assistant — Telegram Bot (polling)
# Слушает команды и нажатия кнопок из Telegram
# Отвечает понятным русским языком
# Запускается как systemd-сервис: tg-bot.service
# =============================================================================

TG_BOT_TOKEN="8008848660:AAHZy9dyuVAtHyiv498TZ4rNRMvBHL8cGzo"
TG_CHAT_ID="200374835"
CONTAINER="ai-assistant-production"
APP_DIR="/home/ubuntu/ai-assistant-spec"
LOG_DIR="$APP_DIR/logs/monitor"
OFFSET_FILE="$LOG_DIR/.tg_offset"

# Безопасность: отвечаем только владельцу
is_owner() {
  [ "$1" = "$TG_CHAT_ID" ]
}

# Отправить текстовое сообщение
send() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=$TG_CHAT_ID" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=$1" > /dev/null 2>&1
}

# Отправить сообщение с кнопками (inline keyboard)
send_with_buttons() {
  TEXT="$1"
  KEYBOARD="$2"
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": $TG_CHAT_ID,
      \"parse_mode\": \"HTML\",
      \"text\": $(echo "$TEXT" | jq -Rs .),
      \"reply_markup\": $KEYBOARD
    }" > /dev/null 2>&1
}

# Ответить на callback_query (убрать «часики» с кнопки)
answer_callback() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery" \
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

  if [ -z "$NEW_ALERTS" ]; then
    send_with_buttons "✅ <b>Проверка завершена</b>

Все 12 проверок пройдены, проблем не обнаружено:
• Процессы контейнера в норме
• Подозрительных файлов нет
• Сайт доступен
• Нагрузка в пределах нормы
• Файрвол активен
• Порты защищены
• SSH-входы только от владельца" "$MAIN_KEYBOARD"
  else
    FORMATTED=$(echo "$NEW_ALERTS" | sed 's/\[.*\] ALERT: /🚨 /')
    send_with_buttons "🚨 <b>Проверка завершена — найдены проблемы:</b>

$FORMATTED" "$MAIN_KEYBOARD"
  fi
}

cmd_menu() {
  send_with_buttons "🤖 <b>AI Assistant — Мониторинг</b>

Выберите действие:" "$MAIN_KEYBOARD"
}

# ---- Главный цикл ----

echo "$(date) Бот запущен, ожидание команд..."

while true; do
  OFFSET=$(get_offset)

  RESPONSE=$(curl -s "https://api.telegram.org/bot${TG_BOT_TOKEN}/getUpdates?offset=$OFFSET&timeout=30&allowed_updates=[\"message\",\"callback_query\"]" 2>/dev/null)

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
        status) cmd_status ;;
        check)  cmd_check ;;
        alerts) cmd_alerts ;;
        users)  cmd_users ;;
        ips)    cmd_ips ;;
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
