import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [template, styles, model, app] = await Promise.all([
  read('src/index.html'), read('dist/style.css'), read('dist/model.mjs'), read('dist/app.mjs')
]);
const modelImport = /^import \{[^\n]+\} from '\.\/model\.mjs';\r?\n/;
if (!modelImport.test(app)) throw new Error('Expected the application to import its model on the first line.');
const bundle = `(() => {\n'use strict';\n${model.replace(/^export /gm, '')}\n${app.replace(modelImport, '')}\n})();`;
new Script(bundle, {filename:'netra-browser.js'});
if (!template.includes('<!-- NETRA_STYLES -->') || !template.includes('<!-- NETRA_SCRIPT -->')) {
  throw new Error('The HTML template is missing its asset insertion markers.');
}
const html = template
  .replace('<!-- NETRA_STYLES -->', () => `<style>\n${styles}\n</style>`)
  .replace('<!-- NETRA_SCRIPT -->', () => `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>`);
await writeFile(new URL('dist/index.html', root), html);
console.log(`Built self-contained page: ${fileURLToPath(new URL('dist/index.html', root))}`);
