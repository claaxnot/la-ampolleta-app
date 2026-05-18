const fs = require('fs');

const content = fs.readFileSync('src/pages/WorkerDashboard.jsx', 'utf8');
const matches = [];

// Match className="..."
const doubleQuoteRegex = /className="([^"]+)"/g;
let match;
while ((match = doubleQuoteRegex.exec(content)) !== null) {
  matches.push({
    className: match[1],
    line: content.substring(0, match.index).split('\n').length
  });
}

// Match className='...'
const singleQuoteRegex = /className='([^']+)'/g;
while ((match = singleQuoteRegex.exec(content)) !== null) {
  matches.push({
    className: match[1],
    line: content.substring(0, match.index).split('\n').length
  });
}

// Match className={`...`}
const backtickRegex = /className=\{\`([\s\S]*?)\`\}/g;
while ((match = backtickRegex.exec(content)) !== null) {
  const cleanClass = match[1].replace(/\$\{[^}]+\}/g, ' ');
  matches.push({
    className: cleanClass,
    line: content.substring(0, match.index).split('\n').length
  });
}

matches.sort((a, b) => a.line - b.line);

const checkRealConflicts = (className) => {
  const classes = className.split(/[\s\n\r]+/).filter(Boolean);
  const conflicts = [];

  // Real text color conflicts
  const standardTextColors = classes.filter(c => {
    if (!c.startsWith('text-')) return false;
    // Ignore sizes and positioning
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

console.log('--- REAL CLASSNAME CONFLICTS ANALYSIS ---');
let total = 0;
for (const m of matches) {
  const confs = checkRealConflicts(m.className);
  if (confs.length > 0) {
    total += confs.length;
    console.log(`\nLine ${m.line}:`);
    console.log(`  className: "${m.className.trim()}"`);
    for (const c of confs) {
      console.log(`  -> ${c}`);
    }
  }
}
console.log(`\nTotal real conflicts found: ${total}`);
