/**
 * Сервис отправки email
 * Использует nodemailer с SMTP
 */

import nodemailer from 'nodemailer';

// Конфигурация транспорта
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('⚠️ SMTP не настроен. Email не будут отправляться.');
    return null;
  }

  // Для Gmail используем специальный сервис
  if (host === 'smtp.gmail.com') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  // Для других провайдеров используем стандартный SMTP
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransport();
  }
  return transporter;
}

// Отправка email
export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ success: boolean; error?: string }> {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 [DEV] Email would be sent to:', options.to);
    console.log('   Subject:', options.subject);
    console.log('   Text:', options.text?.substring(0, 200));
    return { success: true }; // В dev режиме считаем успехом
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    
    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка отправки email' 
    };
  }
}

// Экранирование HTML для безопасности
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Шаблон письма для верификации email
export function getEmailVerificationContent(verifyUrl: string, userName?: string): {
  subject: string;
  text: string;
  html: string;
} {
  const appName = 'mentorix';
  const name = userName || 'Пользователь';
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verifyUrl);

  return {
    subject: `${appName} — Подтвердите email`,
    text: `
Здравствуйте, ${name}!

Спасибо за регистрацию в ${appName}.

Для подтверждения email перейдите по ссылке:
${verifyUrl}

Ссылка действительна 24 часа.

Если вы не регистрировались, просто проигнорируйте это письмо.

---
${appName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <p>Здравствуйте, <strong>${safeName}</strong>!</p>
      <p>Спасибо за регистрацию в ${appName}.</p>
      <p>Нажмите кнопку ниже, чтобы подтвердить ваш email:</p>
      <p style="text-align: center;">
        <a href="${safeUrl}" class="button">Подтвердить email</a>
      </p>
      <p>Или скопируйте ссылку:</p>
      <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">${safeUrl}</p>
      <p class="footer">
        Ссылка действительна <strong>24 часа</strong>.<br>
        Если вы не регистрировались, просто проигнорируйте это письмо.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
}

// Шаблон письма для сброса пароля
export function getPasswordResetEmailContent(resetUrl: string, userName?: string): {
  subject: string;
  text: string;
  html: string;
} {
  const appName = 'mentorix';
  const name = userName || 'Пользователь';
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: `${appName} — Сброс пароля`,
    text: `
Здравствуйте, ${name}!

Вы запросили сброс пароля для вашего аккаунта в ${appName}.

Для установки нового пароля перейдите по ссылке:
${resetUrl}

Ссылка действительна 1 час.

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

---
${appName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      <p>Здравствуйте, <strong>${safeName}</strong>!</p>
      <p>Вы запросили сброс пароля для вашего аккаунта.</p>
      <p>Нажмите кнопку ниже, чтобы установить новый пароль:</p>
      <p style="text-align: center;">
        <a href="${safeUrl}" class="button">Сбросить пароль</a>
      </p>
      <p>Или скопируйте ссылку:</p>
      <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">${safeUrl}</p>
      <p class="footer">
        Ссылка действительна <strong>1 час</strong>.<br>
        Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
}
