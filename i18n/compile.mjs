import fs from 'fs';
const dir=process.argv[2], out=process.argv[3];
const keys=JSON.parse(fs.readFileSync(dir+'/keep.json','utf8'));
const extra=fs.existsSync(dir+'/tr/extra.tsv')?fs.readFileSync(dir+'/tr/extra.tsv','utf8'):'';
const dict={}; let bad=0;
for(const f of fs.readdirSync(dir+'/tr').filter(f=>/^\d+\.tsv$/.test(f)).sort()){
  for(const line of fs.readFileSync(dir+'/tr/'+f,'utf8').split('\n')){ if(!line.trim())continue;
    const t=line.indexOf('\t'); const i=+line.slice(0,t), v=line.slice(t+1);
    let k=keys[i]; if(k==null){bad++;continue}
    const ph=s=>(s.match(/\{\d\}/g)||[]).sort().join();
    if(ph(k)!==ph(v)){console.error('PH',i,k,'|',v);bad++;continue}
    k=k.replace(/\{n\}/g,'{9}'); const vv=v.replace(/\{n\}/g,'{9}'); dict[k]=vv;
    // «{0}Текст» / «Текст {0}», где {0} — значок отдельным элементом: добавить и голый текст
    const a=k.match(/^\{(\d)\}\s?([^{}]+)$/), b=vv.match(/^\{(\d)\}\s?([^{}]+)$/);
    if(a&&b&&a[1]===b[1]&&!dict[a[2].trim()]) dict[a[2].trim()]=b[2].trim();
    const c=k.match(/^([^{}]+?)\s?\{(\d)\}$/), d=vv.match(/^([^{}]+?)\s?\{(\d)\}$/);
    if(c&&d&&c[2]===d[2]&&!dict[c[1].trim()]) dict[c[1].trim()]=d[1].trim(); }
}
for(const line of extra.split('\n')){ if(!line.trim()||line.startsWith('#'))continue; const [k,v]=line.split('\t'); dict[k]=v; }
// «· Текст {0}», «, после {0}» — кусок, приклеенный к соседнему: добавить и без разделителя
for(const [k,v] of Object.entries(dict)){ const m=k.match(/^[·,.—–;:]\s+/), n=v.match(/^[·,.—–;:]\s+/); if(m&&n){ const kk=k.slice(m[0].length), vv=v.slice(n[0].length); if(kk&&!dict[kk]) dict[kk]=vv } }
// «🔁 Текст» — значок deEmo превращает в отдельный элемент: добавить голый текст
const EMO=/^[^\p{L}\p{N}{«"(+−–—•·✓✎⏹]+\s+/u;
for(const [k,v] of Object.entries(dict)){ const m=k.match(EMO), n=v.match(EMO); if(m&&n){ const kk=k.slice(m[0].length), vv=v.slice(n[0].length); if(kk&&!dict[kk]) dict[kk]=vv } }
fs.writeFileSync(out,'// АВТОМАТИЧЕСКИ: словарь «русский → английский» для i18n.js (tools: scratch tr/*.tsv)\nwindow.EN_DICT='+JSON.stringify(dict)+'\n');
console.log(Object.keys(dict).length,'entries',bad,'bad');
