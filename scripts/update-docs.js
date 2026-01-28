#!/usr/bin/env node
/**
 * Автоматическое обновление документации при коммите
 * Запускается через pre-commit hook
 * 
 * Что обновляется:
 * 1. PROJECT_STATUS.md — полная регенерация (страницы, API, компоненты, модели)
 * 2. CHANGELOG.md — добавление записи о коммите с классификацией изменений
 * 3. ARCHITECTURE.md — обновление секций (компоненты, API endpoints)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
// 3. Получаем информацию о коммите и изменённых файлах
// ============================================================

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitMessage() {
  // Читаем сообщение из .git/COMMIT_EDITMSG если есть, иначе парсим из git log
  const commitMsgPath = path.join(ROOT, '.git/COMMIT_EDITMSG');
  if (fs.existsSync(commitMsgPath)) {
    return fs.readFileSync(commitMsgPath, 'utf8').trim().split('\n')[0];
  }
  return 'обновление';
}

function classifyChanges(files) {
  const categories = {
    api: [],
    components: [],
    pages: [],
    lib: [],
    prisma: [],
    docs: [],
    config: [],
    other: []
  };

  for (const file of files) {
    if (file.startsWith('app/api/')) {
      categories.api.push(file);
    } else if (file.startsWith('components/')) {
      categories.components.push(file);
    } else if (file.startsWith('app/') && file.endsWith('page.tsx')) {
      categories.pages.push(file);
    } else if (file.startsWith('lib/')) {
      categories.lib.push(file);
    } else if (file.startsWith('prisma/')) {
      categories.prisma.push(file);
    } else if (file.startsWith('docs/') || file.endsWith('.md')) {
      categories.docs.push(file);
    } else if (file.includes('config') || file.endsWith('.json') || file.endsWith('.js') && !file.includes('/')) {
      categories.config.push(file);
    } else {
      categories.other.push(file);
    }
  }

  return categories;
}

// ============================================================
// 4. Обновляем CHANGELOG.md
// ============================================================

function updateChangelog(files, commitMsg) {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) return;

  const content = fs.readFileSync(changelogPath, 'utf8');
  const now = new Date().toISOString().split('T')[0];
  const categories = classifyChanges(files);

  // Формируем запись
  let entry = `### ${now} — ${commitMsg}\n`;

  if (categories.api.length > 0) {
    entry += `- 🔌 API: ${categories.api.length} файлов (${categories.api.slice(0, 3).map(f => path.basename(f, '.ts')).join(', ')}${categories.api.length > 3 ? '...' : ''})\n`;
  }
  if (categories.components.length > 0) {
    entry += `- 🧩 Компоненты: ${categories.components.length} файлов (${categories.components.slice(0, 3).map(f => path.basename(f, '.tsx')).join(', ')}${categories.components.length > 3 ? '...' : ''})\n`;
  }
  if (categories.pages.length > 0) {
    entry += `- 📄 Страницы: ${categories.pages.length} файлов\n`;
  }
  if (categories.lib.length > 0) {
    entry += `- 📚 Библиотеки: ${categories.lib.length} файлов (${categories.lib.slice(0, 3).map(f => path.basename(f, '.ts')).join(', ')}${categories.lib.length > 3 ? '...' : ''})\n`;
  }
  if (categories.prisma.length > 0) {
    entry += `- 🗄️ База данных: ${categories.prisma.length} файлов\n`;
  }
  if (categories.config.length > 0) {
    entry += `- ⚙️ Конфигурация: ${categories.config.length} файлов\n`;
  }
  if (categories.docs.length > 0) {
    entry += `- 📝 Документация: ${categories.docs.length} файлов\n`;
  }
  if (categories.other.length > 0) {
    entry += `- 📦 Другое: ${categories.other.length} файлов\n`;
  }

  entry += '\n';

  // Вставляем после ## [Unreleased]
  const marker = '## [Unreleased]\n';
  const markerIndex = content.indexOf(marker);
  
  if (markerIndex === -1) {
    console.log('⚠️  CHANGELOG.md: не найден маркер [Unreleased]');
    return;
  }

  const insertPos = markerIndex + marker.length;
  const newContent = content.slice(0, insertPos) + '\n' + entry + content.slice(insertPos);

  fs.writeFileSync(changelogPath, newContent);
  console.log('✅ CHANGELOG.md обновлён');

  try {
    execSync(`git add "${changelogPath}"`, { cwd: ROOT });
  } catch {}
}

// ============================================================
// 5. Обновляем ARCHITECTURE.md
// ============================================================

function updateArchitecture(files) {
  const archPath = path.join(ROOT, 'docs/ARCHITECTURE.md');
  if (!fs.existsSync(archPath)) return;

  let content = fs.readFileSync(archPath, 'utf8');
  let updated = false;

  // Обновляем список компонентов если были изменены
  const componentFiles = files.filter(f => f.startsWith('components/'));
  if (componentFiles.length > 0) {
    const components = getComponents();
    
    // Находим секцию компонентов и обновляем
    const componentsSectionRegex = /(## 7\. КОМПОНЕНТЫ[\s\S]*?)(---\n\n## 8\.)/;
    const match = content.match(componentsSectionRegex);
    
    if (match) {
      // Генерируем новую секцию
      const allComponents = components.filter(c => !c.includes('/'));
      const goalComponents = components.filter(c => c.startsWith('goals/'));
      
      const newSection = `## 7. КОМПОНЕНТЫ

### Список компонентов (${allComponents.length} основных + ${goalComponents.length} для целей)

**Основные:**
${allComponents.map(c => `- \`${c}\``).join('\n')}

**Компоненты целей (goals/):**
${goalComponents.map(c => `- \`${c}\``).join('\n')}

### Иерархия компонентов целей

\`\`\`
app/goals/page.tsx
├── DreamSection.tsx         # Мечта
├── YearSection.tsx          # Годовые цели (для каждого года до мечты)
│   └── [копирование в Q/M/W]
├── HalfYearSection.tsx      # Полугодия (H1/H2)
├── QuarterSection.tsx       # Кварталы (Q1-Q4)
│   └── [копирование в M/W]
└── MonthSection.tsx         # Месяцы
    └── [копирование в W, показ недель]
\`\`\`

### Компоненты страницы Daily

\`\`\`
app/daily/page.tsx
├── DatePickerWithIndicators  # Календарь с индикаторами
├── [список задач]            # Чекбоксы, drag & drop
├── [чат с AI]                # Сообщения, input
└── [результат check-plan]    # Рекомендации AI
\`\`\`

### Компоненты Dashboard

\`\`\`
app/page.tsx
├── Speedometer              # Прогресс к мечте
├── DreamProgress            # Детали прогресса
├── BalanceFlags             # Здоровье, семья, энергия
└── [график оценок]          # Recharts LineChart
\`\`\`

---

## 8.`;
      
      content = content.replace(componentsSectionRegex, newSection);
      updated = true;
      console.log('✅ ARCHITECTURE.md: обновлена секция компонентов');
    }
  }

  if (updated) {
    fs.writeFileSync(archPath, content);
    try {
      execSync(`git add "${archPath}"`, { cwd: ROOT });
    } catch {}
  }
}

// ============================================================
// 6. Генерируем PROJECT_STATUS.md
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
// 7. Запускаем
// ============================================================

function main() {
  console.log('📝 Обновляю документацию...');
  
  // Получаем изменённые файлы
  const stagedFiles = getStagedFiles();
  const commitMsg = getCommitMessage();
  
  // 1. Обновляем CHANGELOG.md
  if (stagedFiles.length > 0) {
    updateChangelog(stagedFiles, commitMsg);
  }
  
  // 2. Обновляем ARCHITECTURE.md при изменении компонентов/API
  if (stagedFiles.some(f => f.startsWith('components/') || f.startsWith('app/api/'))) {
    updateArchitecture(stagedFiles);
  }
  
  // 3. Генерируем PROJECT_STATUS.md (всегда)
  const statusContent = generateProjectStatus();
  const statusPath = path.join(ROOT, 'PROJECT_STATUS.md');
  
  fs.writeFileSync(statusPath, statusContent);
  console.log('✅ PROJECT_STATUS.md обновлён');
  
  // Добавляем в staged файлы
  try {
    execSync(`git add "${statusPath}"`, { cwd: ROOT });
    console.log('✅ PROJECT_STATUS.md добавлен в коммит');
  } catch (e) {
    console.log('⚠️  Не удалось добавить в git');
  }
}

main();
