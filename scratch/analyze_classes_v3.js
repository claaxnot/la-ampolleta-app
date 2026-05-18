const fs = require('fs');

const content = fs.readFileSync('src/pages/WorkerDashboard.jsx', 'utf8');

// Find all classNames (handles double quotes, single quotes, and backticks)
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

// Match className={`...`} (we extract the content inside the backticks)
const backtickRegex = /className=\{\`([\s\S]*?)\`\}/g;
while ((match = backtickRegex.exec(content)) !== null) {
  // We can clean up JSX expressions like ${active ? '...' : '...'} to analyze static classes
  const cleanClass = match[1].replace(/\$\{[^}]+\}/g, ' ');
  matches.push({
    className: cleanClass,
    line: content.substring(0, match.index).split('\n').length
  });
}

// Sort by line number
matches.sort((a, b) => a.line - b.line);

const checkConflicts = (className) => {
  const classes = className.split(/[\s\n\r]+/).filter(Boolean);
  const conflicts = [];

  // 1. Exact duplicates
  const seen = new Set();
  const duplicates = [];
  for (const c of classes) {
    if (seen.has(c)) {
      duplicates.push(c);
    }
    seen.add(c);
  }
  if (duplicates.length > 0) {
    conflicts.push(`Duplicate exact classes: ${duplicates.join(', ')}`);
  }

  // 2. Specific conflicts
  if (classes.includes('block') && classes.includes('flex')) conflicts.push('Conflicting display: block & flex');
  if (classes.includes('inline-block') && classes.includes('flex')) conflicts.push('Conflicting display: inline-block & flex');
  if (classes.includes('hidden') && classes.includes('flex')) conflicts.push('Conflicting display: hidden & flex');
  if (classes.includes('hidden') && classes.includes('block')) conflicts.push('Conflicting display: hidden & block');
  if (classes.includes('transition-colors') && classes.includes('transition-all')) conflicts.push('Conflicting transitions: transition-colors & transition-all');

  // 3. Category duplication (e.g. mt-1 mt-2)
  const prefixes = [
    { name: 'Width', pattern: /^w-/ },
    { name: 'Height', pattern: /^h-/ },
    { name: 'Margin Top', pattern: /^mt-/ },
    { name: 'Margin Bottom', pattern: /^mb-/ },
    { name: 'Margin Left', pattern: /^ml-/ },
    { name: 'Margin Right', pattern: /^mr-/ },
    { name: 'Margin X', pattern: /^mx-/ },
    { name: 'Margin Y', pattern: /^my-/ },
    { name: 'Padding X', pattern: /^px-/ },
    { name: 'Padding Y', pattern: /^py-/ },
    { name: 'Padding Top', pattern: /^pt-/ },
    { name: 'Padding Bottom', pattern: /^pb-/ },
    { name: 'Padding Left', pattern: /^pl-/ },
    { name: 'Padding Right', pattern: /^pr-/ },
    { name: 'Text Size', pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/ },
    { name: 'Font Weight', pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/ },
    { name: 'Border Radius', pattern: /^rounded-(none|sm|md|lg|xl|2xl|3xl|full)$/ },
    { name: 'Transition Type', pattern: /^transition-(none|all|colors|opacity|shadow|transform)$/ }
  ];

  for (const pref of prefixes) {
    const matching = classes.filter(c => pref.pattern.test(c));
    if (matching.length > 1) {
      conflicts.push(`Duplicate ${pref.name} definitions: ${matching.join(', ')}`);
    }
  }

  // 4. Overlapping paddings/margins (e.g., p-4 px-2)
  if (classes.some(c => /^p-[^-]+$/.test(c)) && classes.some(c => /^px-[^-]+$/.test(c))) conflicts.push('Overlapping padding: p-* and px-*');
  if (classes.some(c => /^p-[^-]+$/.test(c)) && classes.some(c => /^py-[^-]+$/.test(c))) conflicts.push('Overlapping padding: p-* and py-*');
  if (classes.some(c => /^m-[^-]+$/.test(c)) && classes.some(c => /^mx-[^-]+$/.test(c))) conflicts.push('Overlapping margin: m-* and mx-*');
  if (classes.some(c => /^m-[^-]+$/.test(c)) && classes.some(c => /^my-[^-]+$/.test(c))) conflicts.push('Overlapping margin: m-* and my-*');

  return conflicts;
};

console.log('--- DEEP COMPREHENSIVE CLASSNAME ANALYSIS ---');
let total = 0;
for (const m of matches) {
  const confs = checkConflicts(m.className);
  if (confs.length > 0) {
    total += confs.length;
    console.log(`\nLine ${m.line}:`);
    console.log(`  className: "${m.className.trim()}"`);
    for (const c of confs) {
      console.log(`  -> ${c}`);
    }
  }
}
console.log(`\nTotal conflicts/duplicates found: ${total}`);
