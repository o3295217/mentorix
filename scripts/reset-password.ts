#!/usr/bin/env npx tsx
/**
 * Скрипт для сброса пароля пользователя
 * 
 * Использование:
 *   npx tsx scripts/reset-password.ts <email> <новый_пароль>
 * 
 * Пример:
 *   npx tsx scripts/reset-password.ts o3295217@gmail.com myNewPassword123
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const authSecret = process.env.AUTH_SECRET || 'dev-secret-key-change-in-production';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + authSecret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const [,, email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error('❌ Использование: npx tsx scripts/reset-password.ts <email> <новый_пароль>');
    console.error('   Пример: npx tsx scripts/reset-password.ts o3295217@gmail.com myNewPassword123');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Пароль должен быть не менее 8 символов');
    process.exit(1);
  }

  try {
    // Проверяем существует ли пользователь
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      console.error(`❌ Пользователь с email "${email}" не найден`);
      
      // Показываем список пользователей
      const users = await prisma.user.findMany({ select: { email: true, name: true } });
      if (users.length > 0) {
        console.log('\n📋 Существующие пользователи:');
        users.forEach(u => console.log(`   - ${u.email} (${u.name || 'без имени'})`));
      }
      process.exit(1);
    }

    // Хешируем новый пароль
    const passwordHash = await hashPassword(newPassword);

    // Обновляем пароль
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Удаляем все сессии пользователя
    const deletedSessions = await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    console.log('✅ Пароль успешно сброшен!');
    console.log(`   Email: ${email}`);
    console.log(`   Имя: ${user.name || '-'}`);
    console.log(`   Удалено сессий: ${deletedSessions.count}`);
    console.log('\n💡 Теперь можете войти с новым паролем на http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
