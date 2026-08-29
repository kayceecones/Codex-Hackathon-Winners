const fs = require('fs');

const results = [];

function check(name, condition) {
  results.push({ name, passed: !!condition });
  console.log(`${condition ? 'PASSED' : 'FAILED'}: ${name}`);
}

const css = fs.existsSync('demo-app/style.css') ? fs.readFileSync('demo-app/style.css', 'utf8') : '';
const js = fs.existsSync('demo-app/app.js') ? fs.readFileSync('demo-app/app.js', 'utf8') : '';

check('style.css defines a dark theme rule', /\[data-theme=["']dark["']\]|\.dark\b/.test(css));
check('app.js has a theme toggle handler', /theme/i.test(js) && /(addEventListener|onclick)/i.test(js));

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
