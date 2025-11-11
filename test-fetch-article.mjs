import fetch from 'node-fetch';
import fs from 'fs';

const url = 'https://forum.netmarble.com/sk_rebirth_gl/view/13/1270';
const html = await fetch(url).then(r => r.text());
fs.writeFileSync('test-article.html', html, 'utf8');
console.log('Article HTML saved to test-article.html');
console.log('First 1000 chars:');
console.log(html.substring(0, 1000));
