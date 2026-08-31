const fs = require('fs');
const path = require('path');
const root = process.argv[2];
['pages/movie/movie.wxss','pages/character/character.wxss'].forEach(f => {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  const hex  = (s.match(/#[0-9A-Fa-f]{3,8}\b/g) || []).length;
  const w500 = (s.match(/font-weight:\s*500/g) || []).length;
  const w800 = (s.match(/font-weight:\s*800/g) || []).length;
  const w700 = (s.match(/font-weight:\s*700/g) || []).length;
  const w600 = (s.match(/font-weight:\s*600/g) || []).length;
  console.log(f + ' | raw_hex=' + hex + ' | 500=' + w500 + ' | 800=' + w800 + ' | 700=' + w700 + ' | 600=' + w600);
});
