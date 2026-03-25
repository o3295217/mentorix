// Telegram notifications with deduplication
// Max 1 message per error type per 5 minutes

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TG_CHAT_ID || '';

const lastSent = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function notifyTelegram(text: string, dedupeKey?: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;

  if (dedupeKey) {
    const last = lastSent.get(dedupeKey) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
    lastSent.set(dedupeKey, Date.now());
  }

  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        parse_mode: 'HTML',
        text,
      }),
    });
  } catch {
    // не блокируем основной процесс
  }
}
