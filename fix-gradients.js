const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

// Replacements for each file
const fileReplacements = {
  'app/periods/page.tsx': [
    // Main card
    [/card bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600/g, 'card'],
    // Period buttons inactive
    [/bg-slate-700 border-slate-500 hover:border-blue-500/g, 'bg-gray-900/80 border-gray-700 hover:border-blue-400'],
    // Summary area
    [/rounded-lg p-4 border bg-slate-700 border-slate-600/g, 'rounded-lg p-4 border border-gray-700 bg-gray-800/50'],
    // Success bar
    [/rounded-lg bg-slate-700 border-green-500/g, 'rounded-lg bg-gray-800/50 border border-green-500/30'],
    // History cards
    [/bg-slate-700 border-slate-600 hover:border-blue-500/g, 'bg-gray-900/80 border-gray-700 hover:border-blue-400'],
  ],
  'app/periods/[id]/page.tsx': [
    [/card bg-gradient-to-br from-purple-950\/30 to-purple-900\/30 border-purple-900/g, 'card'],
    [/card bg-gradient-to-br from-blue-950\/30 to-blue-900\/30 border-blue-900/g, 'card'],
    [/card bg-blue-950\/25 border-blue-900/g, 'card'],
    [/card bg-green-950\/25 border-green-900/g, 'card'],
    [/card bg-yellow-950\/25 border-yellow-900/g, 'card'],
    [/card bg-red-950\/25 border-red-900/g, 'card'],
    [/card bg-purple-950\/25 border-purple-900/g, 'card'],
    [/card bg-orange-900\/20 border-orange-700/g, 'card'],
    [/card bg-teal-900\/20 border-teal-700/g, 'card'],
    [/card bg-indigo-900\/20 border-indigo-700/g, 'card'],
    [/card bg-red-900\/20 border-2 border-red-700/g, 'card'],
    [/card bg-gradient-to-br from-pink-900\/20 to-purple-900\/20 border-pink-700/g, 'card'],
    [/card bg-gradient-to-br from-green-900\/20 to-teal-900\/20 border-green-700/g, 'card'],
    [/card bg-gradient-to-br from-purple-900\/30 to-indigo-900\/30 border-purple-700/g, 'card'],
  ],
  'app/evaluation/[date]/page.tsx': [
    [/card text-center bg-gradient-to-r from-purple-900\/40 to-blue-900\/40 border-purple-600/g, 'card text-center'],
    [/card text-center bg-gradient-to-r from-primary-900\/30 to-purple-900\/30/g, 'card text-center'],
    [/card bg-red-900\/30 border border-red-700/g, 'card'],
    [/card bg-purple-900\/30 border-purple-700/g, 'card'],
    [/card bg-green-900\/30 border border-green-700/g, 'card'],
  ],
  'app/page.tsx': [
    // Dashboard quick links - keep hover:border-*-500/40 as subtle accent, just clean selector
    // These are fine - they use .card base + hover color accent. That's OK for dashboard.
  ],
};

let totalChanges = 0;

Object.entries(fileReplacements).forEach(([file, replacements]) => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) {
    console.log('SKIP: ' + file);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  let fileChanges = 0;
  
  replacements.forEach(([pattern, replacement]) => {
    const matches = content.match(pattern);
    if (matches) {
      fileChanges += matches.length;
      content = content.replace(pattern, replacement);
    }
  });
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('FIXED: ' + file + ' (' + fileChanges + ' changes)');
    totalChanges += fileChanges;
  } else {
    console.log('OK: ' + file);
  }
});

console.log('\nTotal: ' + totalChanges + ' replacements');
