const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const user = await p.user.findFirst({ where: { email: 'o3295217@gmail.com' } });
  if (!user) { console.log('User not found'); return; }

  const goals = await p.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 });
  console.log('=== GOALS (raw from DB) ===');
  goals.forEach(g => console.log('text:', g.text));

  const daily = await p.dailyEntry.findFirst({ where: { userId: user.id, date: { gte: new Date('2026-04-08') } }, orderBy: { date: 'desc' } });
  if (daily) {
    console.log('\n=== DAILY ENTRY (raw) ===');
    console.log('planText:', daily.planText?.substring(0, 120));
    console.log('factText:', daily.factText?.substring(0, 120));
  }

  const tasks = await p.openTask.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 });
  console.log('\n=== OPEN TASKS (raw) ===');
  tasks.forEach(t => console.log('taskText:', t.taskText?.substring(0, 120)));

  await p.$disconnect();
})();
