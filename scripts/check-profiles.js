const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          name: true,
          occupation: true,
          location: true,
          age: true,
          hobbies: true,
          sports: true,
          values: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('=== Все пользователи и их профили ===');
  console.log('Всего пользователей:', users.length);
  console.log('');

  for (const u of users) {
    const p = u.profile;
    console.log('User:', u.email, '(' + (u.name || 'без имени') + ')');
    console.log('  ID:', u.id);
    console.log('  Создан:', u.createdAt.toISOString());
    if (p) {
      console.log('  Профиль: ДА (id=' + p.id + ')');
      console.log('    Имя:', p.name || '-');
      console.log('    Должность:', p.occupation || '-');
      console.log('    Город:', p.location || '-');
      console.log('    Возраст:', p.age || '-');
      console.log('    Хобби:', p.hobbies || '-');
      console.log('    Спорт:', p.sports || '-');
      console.log('    Ценности:', p.values || '-');
      console.log('    Обновлён:', p.updatedAt.toISOString());
    } else {
      console.log('  Профиль: НЕТ');
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
