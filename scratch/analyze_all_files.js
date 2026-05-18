const fs = require('fs');
const path = require('path');

const getFiles = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
      results.push(fullPath);
    }
  });
  return results;
};

const checkRealConflicts = (className) => {
  const classes = className.split(/[\s\n\r]+/).filter(Boolean);
  const conflicts = [];

  // Real text color conflicts
  const standardTextColors = classes.filter(c => {
    if (!c.startsWith('text-')) return false;
    if (/^text-\[.*\]$/.test(c)) return false;
    if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|2xs)$/.test(c)) return false;
    if (/^text-(left|right|center|justify|start|end|wrap|nowrap|balance)$/.test(c)) return false;
    return true;
  });

  if (standardTextColors.length > 1) {
    conflicts.push(`Conflicting text colors: ${standardTextColors.join(', ')}`);
  }

  // Real bg color conflicts
  const standardBgColors = classes.filter(c => {
    if (!c.startsWith('bg-')) return false;
    if (/^bg-\[.*\]$/.test(c)) return false;
    if (/^bg-(cover|contain|center|top|bottom|left|right|fixed|local|scroll|no-repeat|repeat|repeat-x|repeat-y|none)$/.test(c)) return false;
    if (c.startsWith('bg-gradient-')) return false;
    return true;
  });

  if (standardBgColors.length > 1) {
    conflicts.push(`Conflicting background colors: ${standardBgColors.join(', ')}`);
  }

  // Real display conflicts
  if (classes.includes('block') && classes.includes('flex')) conflicts.push('Conflicting display: block & flex');
  if (classes.includes('inline-block') && classes.includes('flex')) conflicts.push('Conflicting display: inline-block & flex');
  if (classes.includes('hidden') && classes.includes('flex')) conflicts.push('Conflicting display: hidden & flex');
  if (classes.includes('hidden') && classes.includes('block')) conflicts.push('Conflicting display: hidden & block');
  
  // Real transition conflicts
  if (classes.includes('transition-colors') && classes.includes('transition-all')) conflicts.push('Conflicting transitions: transition-colors & transition-all');

  return conflicts;
};

console.log('--- GLOBAL CLASSNAME CONFLICTS ANALYSIS ---');
const files = getFiles('src');
let grandTotal = 0;

for (const file of files) {
  if (file.endsWith('.css')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const matches = [];

  const doubleQuoteRegex = /className="([^"]+)"/g;
  let match;
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    matches.push({ className: match[1], line: content.substring(0, match.index).split('\n').length });
  }

  const singleQuoteRegex = /className='([^']+)'/g;
  while ((match = singleQuoteRegex.exec(content)) !== null) {
    matches.push({ className: match[1], line: content.substring(0, match.index).split('\n').length });
  }

  const backtickRegex = /className=\{\`([\s\S]*?)\`\}/g;
  while ((match = backtickRegex.exec(content)) !== null) {
    const cleanClass = match[1].replace(/\$\{[^}]+\}/g, ' ');
    matches.push({ className: cleanClass, line: content.substring(0, match.index).split('\n').length });
  }

  let fileHeaderPrinted = false;
  for (const m of matches) {
    const confs = checkRealConflicts(m.className);
    if (confs.length > 0) {
      if (!fileHeaderPrinted) {
        console.log(`\n📄 File: ${file}`);
        fileHeaderPrinted = true;
      }
      grandTotal += confs.length;
      console.log(`  Line ${m.line}: "${m.className.trim()}"`);
      for (const c of confs) {
        console.log(`    -> ${c}`);
      }
    }
  }
}

console.log(`\nGlobal conflicts found: ${grandTotal}`);
