const fs = require('fs');
const file = 'threat-intel-sources-enhanced-seed.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace pattern: move standalone config into metadata
// Pattern: metadata: { tags: [...] },\n    config: { ... }
// Replace with: metadata: { tags: [...], config: { ... } }

content = content.replace(
  /metadata: \{ tags: (\[[^\]]+\]) \},\n    config: (\{[^}]+\})/g,
  'metadata: { tags: $1, config: $2 }'
);

fs.writeFileSync(file, content);
console.log('Fixed all config fields');
