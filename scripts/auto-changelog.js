#!/usr/bin/env node
/**
 * Автоматическое обновление документации после коммита
 * Запускается через post-commit hook
 * 
 * Логика:
 * 1. Берём последний коммит (message + изменённые файлы)
 * 2. Определяем категорию по путям файлов
 * 3. Записываем в соответствующие файлы документации
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ============================================================
// Категории файлов
// ============================================================

const CATEGORIES = {
  architecture: {
    patterns: [
      /^app\/api\//,
      /^prisma\//,
      /^lib\//,
      /^middleware\.ts$/,
      /^next\.config\.js$/,
      /docker/i,
    ],
    docFile: 'docs/ARCHITECTURE.md',
    sectionName: 'Последние изменения архитектуры'
  },
  userGuide: {
    patterns: [
      /^app\/(?!api).*page\.tsx$/,
      /^app\/.*layout\.tsx$/,
      /^components\//,
    ],
    docFile: 'docs/USER_GUIDE.md',
    sectionName: 'Последние изменения интерфейса'
  },
  development: {
    patterns: [
      /^scripts\//,
      /^\.husky\//,
      /^package\.json$/,
      /tsconfig/,
      /eslint/,
    ],
    docFile: 'docs/DEVELOPMENT.md',
    sectionName: 'Последние изменения инструментария'
  }
};

// ============================================================
// Получаем информацию о последнем коммите
// ============================================================

function getLastCommitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    const message = execSync('git log -1 --pretty=%s', { cwd: ROOT }).toString().trim();
    const files = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: ROOT })
      .toString()
      .trim()
      .split('\n')
      .filter(f => f);
    const date = new Date().toISOString().split('T')[0];
    
    return { hash, message, files, date };
  } catch (e) {
    console.error('Ошибка получения информации о коммите:', e.message);
    return null;
  }
}

// ============================================================
// Определяем категории изменённых файлов
// ============================================================

function categorizeFiles(files) {
  const result = {
    architecture: [],
    userGuide: [],
    development: [],
    other: []
  };

  for (const file of files) {
    let categorized = false;
    
    for (const [category, config] of Object.entries(CATEGORIES)) {
      if (config.patterns.some(pattern => pattern.test(file))) {
        result[category].push(file);
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      result.other.push(file);
    }
  }

  return result;
}

// ============================================================
// Обновляем CHANGELOG.md
// ============================================================

function updateChangelog(commitInfo, categorized) {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    console.log('⚠️  CHANGELOG.md не найден');
    return;
  }

  let content = fs.readFileSync(changelogPath, 'utf8');
  
  // Находим секцию [Unreleased]
  const unreleasedMatch = content.match(/## \[Unreleased\]\n/);
  if (!unreleasedMatch) {
    console.log('⚠️  Секция [Unreleased] не найдена в CHANGELOG.md');
    return;
  }

  // Формируем запись
  const entry = `\n### ${commitInfo.date} — ${commitInfo.message}\n` +
    `- Коммит: \`${commitInfo.hash}\`\n` +
    (categorized.architecture.length ? `- 🏗️ Архитектура: ${categorized.architecture.length} файлов\n` : '') +
    (categorized.userGuide.length ? `- 🎨 Интерфейс: ${categorized.userGuide.length} файлов\n` : '') +
    (categorized.development.length ? `- 🔧 Инструменты: ${categorized.development.length} файлов\n` : '') +
    (categorized.other.length ? `- 📄 Другое: ${categorized.other.length} файлов\n` : '');

  // Вставляем после ## [Unreleased]
  const insertPos = unreleasedMatch.index + unreleasedMatch[0].length;
  content = content.slice(0, insertPos) + entry + content.slice(insertPos);

  fs.writeFileSync(changelogPath, content);
  console.log('✅ CHANGELOG.md обновлён');
}

// ============================================================
// Обновляем документацию категории
// ============================================================

function updateCategoryDoc(category, files, commitInfo) {
  const config = CATEGORIES[category];
  if (!config || files.length === 0) return;

  const docPath = path.join(ROOT, config.docFile);
  
  if (!fs.existsSync(docPath)) {
    console.log(`⚠️  ${config.docFile} не найден`);
    return;
  }

  let content = fs.readFileSync(docPath, 'utf8');
  
  // Ищем или создаём секцию "Последние изменения"
  const sectionHeader = `## ${config.sectionName}`;
  const sectionRegex = new RegExp(`## ${config.sectionName}[\\s\\S]*?(?=\\n## |$)`);
  
  // Формируем новую запись
  const newEntry = `\n### ${commitInfo.date} — ${commitInfo.message}\n` +
    files.map(f => `- \`${f}\``).join('\n') + '\n';

  if (content.includes(sectionHeader)) {
    // Добавляем в существующую секцию
    const match = content.match(sectionRegex);
    if (match) {
      const sectionEnd = match.index + sectionHeader.length + 1;
      content = content.slice(0, sectionEnd) + newEntry + content.slice(sectionEnd);
    }
  } else {
    // Создаём секцию в конце файла
    content += `\n\n${sectionHeader}\n${newEntry}`;
  }

  fs.writeFileSync(docPath, content);
  console.log(`✅ ${config.docFile} обновлён`);
}

// ============================================================
// Коммитим изменения документации
// ============================================================

function commitDocChanges() {
  try {
    // Добавляем только файлы документации
    execSync('git add CHANGELOG.md docs/*.md PROJECT_STATUS.md 2>/dev/null || true', { cwd: ROOT });
    
    // Проверяем есть ли что коммитить
    const status = execSync('git status --porcelain docs/ CHANGELOG.md PROJECT_STATUS.md 2>/dev/null || true', { cwd: ROOT }).toString();
    
    if (status.trim()) {
      execSync('git commit --amend --no-edit --no-verify', { cwd: ROOT });
      console.log('✅ Документация добавлена в коммит');
    }
  } catch (e) {
    console.log('⚠️  Не удалось добавить документацию в коммит:', e.message);
  }
}

// ============================================================
// Главная функция
// ============================================================

function main() {
  console.log('\n📝 Автообновление документации...\n');

  const commitInfo = getLastCommitInfo();
  if (!commitInfo) {
    console.log('❌ Не удалось получить информацию о коммите');
    return;
  }

  // Пропускаем если это коммит самой документации
  if (commitInfo.message.includes('[docs]') || commitInfo.message.includes('auto-docs')) {
    console.log('⏭️  Пропускаем коммит документации');
    return;
  }

  console.log(`📌 Коммит: ${commitInfo.hash} — ${commitInfo.message}`);
  console.log(`📁 Файлов изменено: ${commitInfo.files.length}\n`);

  const categorized = categorizeFiles(commitInfo.files);

  // Обновляем CHANGELOG
  updateChangelog(commitInfo, categorized);

  // Обновляем документы по категориям
  updateCategoryDoc('architecture', categorized.architecture, commitInfo);
  updateCategoryDoc('userGuide', categorized.userGuide, commitInfo);
  updateCategoryDoc('development', categorized.development, commitInfo);

  // Добавляем изменения в коммит
  commitDocChanges();

  console.log('\n✅ Готово!\n');
}

main();
