const fs = require('fs');

const results = [];

function check(name, condition) {
  results.push({ name, passed: !!condition });
  console.log(`${condition ? 'PASSED' : 'FAILED'}: ${name}`);
}

const css = fs.existsSync('demo-app/style.css') ? fs.readFileSync('demo-app/style.css', 'utf8') : '';
const html = fs.existsSync('demo-app/index.html') ? fs.readFileSync('demo-app/index.html', 'utf8') : '';

check('style.css has at least one @media breakpoint', /@media[^{]*\(\s*max-width/i.test(css));
check('index.html has a viewport meta tag', /<meta[^>]+name=["']viewport["']/i.test(html));

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
