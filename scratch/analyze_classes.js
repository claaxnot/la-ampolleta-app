const fs = require('fs');

const content = fs.readFileSync('src/pages/WorkerDashboard.jsx', 'utf8');

// Find all classNames
const classNameRegex = /className="([^"]+)"/g;
let match;
const matches = [];

while ((match = classNameRegex.exec(content)) !== null) {
  matches.push({
    className: match[1],
    index: match.index,
    line: content.substring(0, match.index).split('\n').length
  });
}

// Rules for conflict detection
const rules = [
  {
    name: 'Conflicting Display (block & flex)',
    detect: (classes) => classes.includes('block') && classes.includes('flex')
  },
  {
    name: 'Conflicting Display (inline-block & flex)',
    detect: (classes) => classes.includes('inline-block') && classes.includes('flex')
  },
  {
    name: 'Conflicting Transition (transition-colors & transition-all)',
    detect: (classes) => classes.includes('transition-colors') && classes.includes('transition-all')
  },
  {
    name: 'Conflicting Display (hidden & block)',
    detect: (classes) => classes.includes('hidden') && classes.includes('block')
  },
  {
    name: 'Conflicting Display (hidden & flex)',
    detect: (classes) => classes.includes('hidden') && classes.includes('flex')
  },
  {
    name: 'Duplicate font-size',
    detect: (classes) => {
      const sizes = classes.filter(c => /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(c));
      return sizes.length > 1;
    }
  },
  {
    name: 'Duplicate font-weight',
    detect: (classes) => {
      const weights = classes.filter(c => /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(c));
      return weights.length > 1;
    }
  },
  {
    name: 'Duplicate border-radius',
    detect: (classes) => {
      const radii = classes.filter(c => /^rounded-(none|sm|md|lg|xl|2xl|3xl|full)$/.test(c));
      return radii.length > 1;
    }
  },
  {
    name: 'Duplicate display',
    detect: (classes) => {
      const displays = classes.filter(c => /^(block|inline-block|inline|flex|inline-flex|grid|hidden)$/.test(c));
      return displays.length > 1;
    }
  },
  {
    name: 'Duplicate position',
    detect: (classes) => {
      const positions = classes.filter(c => /^(static|relative|absolute|fixed|sticky)$/.test(c));
      return positions.length > 1;
    }
  }
];

console.log('--- ANALYSIS OF CLASSNAME CONFLICTS ---');
let conflictCount = 0;
for (const m of matches) {
  const classes = m.className.split(/\s+/).filter(Boolean);
  for (const rule of rules) {
    if (rule.detect(classes)) {
      conflictCount++;
      console.log(`[Conflict #${conflictCount}] Line ${m.line}: ${rule.name}`);
      console.log(`  className: "${m.className}"`);
    }
  }
}
console.log(`Total conflicts found: ${conflictCount}`);
