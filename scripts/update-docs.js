#!/usr/bin/env node
/**
 * Автоматическое обновление документации при коммите
 * Запускается через pre-commit hook
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ============================================================
// 1. Собираем информацию о проекте
// ============================================================

function getPackageInfo() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return {
    name: pkg.name,
    version: pkg.version,
    dependencies: Object.keys(pkg.dependencies || {}),
    devDependencies: Object.keys(pkg.devDependencies || {})
  };
}

function getApiRoutes(dir = path.join(ROOT, 'app/api'), prefix = '/api') {
  const routes = [];
  if (!fs.existsSync(dir)) return routes;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'Icon' || item.name.startsWith('.')) continue;
    
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      // Проверяем есть ли route.ts
      const routeFile = path.join(fullPath, 'route.ts');
      if (fs.existsSync(routeFile)) {
        const content = fs.readFileSync(routeFile, 'utf8');
        const methods = [];
        if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET');
        if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST');
        if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT');
        if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE');
        if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH');
        
        routes.push({
          path: `${prefix}/${item.name}`,
          methods: methods.join(', ')
        });
      }
      // Рекурсивно ищем вложенные роуты
      routes.push(...getApiRoutes(fullPath, `${prefix}/${item.name}`));
    }
  }
  return routes;
}

function getPages(dir = path.join(ROOT, 'app'), prefix = '') {
  const pages = [];
  if (!fs.existsSync(dir)) return pages;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'Icon' || item.name.startsWith('.') || item.name === 'api') continue;
    
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      const pagePath = item.name.startsWith('(') ? prefix : `${prefix}/${item.name}`;
      
      // Проверяем есть ли page.tsx
      if (fs.existsSync(path.join(fullPath, 'page.tsx'))) {
        pages.push(pagePath || '/');
      }
      // Рекурсивно
      pages.push(...getPages(fullPath, pagePath));
    }
  }
  return pages;
}

function getComponents() {
  const dir = path.join(ROOT, 'components');
  if (!fs.existsSync(dir)) return [];

  const components = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.name === 'Icon' || item.name.startsWith('.')) continue;
    
    if (item.isFile() && item.name.endsWith('.tsx')) {
      components.push(item.name.replace('.tsx', ''));
    } else if (item.isDirectory()) {
      // Подпапка с компонентами
      const subItems = fs.readdirSync(path.join(dir, item.name));
      for (const subItem of subItems) {
        if (subItem.endsWith('.tsx')) {
          components.push(`${item.name}/${subItem.replace('.tsx', '')}`);
        }
      }
    }
  }
  return components;
}

function getPrismaModels() {
  const schemaPath = path.join(ROOT, 'prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) return [];

  const content = fs.readFileSync(schemaPath, 'utf8');
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const fields = body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//') && !line.startsWith('@@'))
      .map(line => {
        const parts = line.split(/\s+/);
        return { name: parts[0], type: parts[1] };
      })
      .filter(f => f.name && f.type);
    
    models.push({ name, fields });
  }
  return models;
}

// ============================================================
// 2. Генерируем PROJECT_STATUS.md
// ============================================================

function generateProjectStatus() {
  const pkg = getPackageInfo();
  const apiRoutes = getApiRoutes();
  const pages = getPages();
  const components = getComponents();
  const models = getPrismaModels();
  const now = new Date().toISOString().split('T')[0];

  let content = `# Статус проекта

> ⚠️ Этот файл генерируется автоматически при коммите. Не редактируй вручную!
> 
> Последнее обновление: **${now}**

## Общая информация

- **Название:** ${pkg.name}
- **Версия:** ${pkg.version}
- **Фреймворк:** Next.js
- **База данных:** PostgreSQL + Prisma

## Страницы (${pages.length})

| Путь |
|------|
${pages.map(p => `| \`${p}\` |`).join('\n')}

## API Endpoints (${apiRoutes.length})

| Endpoint | Методы |
|----------|--------|
${apiRoutes.map(r => `| \`${r.path}\` | ${r.methods} |`).join('\n')}

## Компоненты (${components.length})

${components.map(c => `- \`${c}\``).join('\n')}

## Модели БД (${models.length})

${models.map(m => `### ${m.name}
| Поле | Тип |
|------|-----|
${m.fields.map(f => `| ${f.name} | \`${f.type}\` |`).join('\n')}
`).join('\n')}

## Зависимости

### Production (${pkg.dependencies.length})
${pkg.dependencies.map(d => `- ${d}`).join('\n')}

### Development (${pkg.devDependencies.length})
${pkg.devDependencies.map(d => `- ${d}`).join('\n')}
`;

  return content;
}

// ============================================================
// 3. Запускаем
// ============================================================

function main() {
  console.log('📝 Обновляю документацию...');
  
  const statusContent = generateProjectStatus();
  const statusPath = path.join(ROOT, 'PROJECT_STATUS.md');
  
  fs.writeFileSync(statusPath, statusContent);
  console.log('✅ PROJECT_STATUS.md обновлён');
  
  // Добавляем в staged файлы
  const { execSync } = require('child_process');
  try {
    execSync(`git add "${statusPath}"`, { cwd: ROOT });
    console.log('✅ PROJECT_STATUS.md добавлен в коммит');
  } catch (e) {
    console.log('⚠️  Не удалось добавить в git (возможно не в репозитории)');
  }
}

main();
