'use client'

// Плейсхолдер-сообщение «Ассистент» в конце ленты чата на «Плане дня»,
// пока запрос отправляется/обрабатывается и стрим ещё не начал приходить.
// Видимая замена малозаметной строки статуса над лентой — сама строка
// остаётся для скринридеров (role="status" где она рендерится), поэтому
// здесь озвучивание намеренно выключено через aria-hidden.

export type ChatProcessingIndicatorProps = {
  text: string
}

export default function ChatProcessingIndicator({ text }: ChatProcessingIndicatorProps) {
  return (
    <div className="py-1" aria-hidden="true">
      <div className="type-secondary mb-1 font-medium">Ассистент</div>
      <div className="type-caption flex items-center gap-2">
        <span>{text}</span>
        <span className="chat-typing-dots">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  )
}
