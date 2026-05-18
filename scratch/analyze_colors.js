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

const checkColorConflicts = (className) => {
  const classes = className.split(/[\s\n\r]+/).filter(Boolean);
  const conflicts = [];

  // Find all text colors (text-something or text-something/opacity)
  // Exclude sizes (text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, etc.)
  // Exclude alignment (text-left, text-center, text-right, text-justify)
  // Exclude word break (text-wrap, text-nowrap, text-balance)
  const textColors = classes.filter(c => {
    if (!c.startsWith('text-')) return false;
    const suffix = c.substring(5);
    if (/^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(suffix)) return false;
    if (/^(left|right|center|justify|start|end)$/.test(suffix)) return false;
    if (/^(wrap|nowrap|balance|pretty)$/.test(suffix)) return false;
    return true;
  });

  if (textColors.length > 1) {
    conflicts.push(`Duplicate Text Colors: ${textColors.join(', ')}`);
  }

  // Find all bg colors (bg-something)
  // Exclude bg positions/sizes/attachment/repeat (bg-cover, bg-center, bg-fixed, bg-no-repeat, bg-repeat, etc.)
  // Exclude bg gradients (bg-gradient-to-r, bg-gradient-to-br, etc.)
  const bgColors = classes.filter(c => {
    if (!c.startsWith('bg-')) return false;
    const suffix = c.substring(3);
    if (/^(cover|contain|center|top|bottom|left|right|fixed|local|scroll|no-repeat|repeat|repeat-x|repeat-y|none)$/.test(suffix)) return false;
    if (suffix.startsWith('gradient-')) return false;
    return true;
  });

  if (bgColors.length > 1) {
    conflicts.push(`Duplicate Background Colors: ${bgColors.join(', ')}`);
  }

  // Find all border colors (border-something)
  // Exclude border sizes/styles (border, border-2, border-4, border-8, border-t, border-b, border-l, border-r, border-solid, border-dashed, border-dotted, border-double, border-none)
  const borderColors = classes.filter(c => {
    if (!c.startsWith('border-')) return false;
    const suffix = c.substring(7);
    if (/^(0|1|2|4|8|t|b|l|r|x|y|solid|dashed|dotted|double|none)$/.test(suffix)) return false;
    if (/^(t|b|l|r|x|y)-(0|1|2|4|8)$/.test(suffix)) return false;
    return true;
  });

  if (borderColors.length > 1) {
    conflicts.push(`Duplicate Border Colors: ${borderColors.join(', ')}`);
  }

  return conflicts;
};

console.log('--- COLOR CONFLICT ANALYSIS ---');
let total = 0;
for (const m of matches) {
  const confs = checkColorConflicts(m.className);
  if (confs.length > 0) {
    total += confs.length;
    console.log(`\nLine ${m.line}:`);
    console.log(`  className: "${m.className.trim()}"`);
    for (const c of confs) {
      console.log(`  -> ${c}`);
    }
  }
}
console.log(`\nTotal color conflicts found: ${total}`);
