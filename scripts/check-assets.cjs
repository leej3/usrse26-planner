const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../docs');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const target=match[1].split('?')[0];if(/^[a-z]+:/.test(target)||target==='./')continue;assert.ok(fs.existsSync(path.join(root,target)),`Missing asset: ${target}`);}
for(const file of fs.readdirSync(root).filter(n=>n.endsWith('.js')))execFileSync(process.execPath,['--check',path.join(root,file)]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
assert.ok(html.includes('Content-Security-Policy'));assert.ok(!html.includes('unsafe-inline')&&!html.includes('unsafe-eval'));
console.log('Static assets, script syntax, install icons, and CSP verified.');
