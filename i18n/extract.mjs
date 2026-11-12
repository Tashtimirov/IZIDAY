import * as acorn from 'acorn'; import * as walk from 'acorn-walk'; import fs from 'fs';
const dir=process.argv[2]; const files=process.argv.slice(3);
const CY=/[А-Яа-яЁё]/; const out=new Map();
function add(seg,file){ seg=seg.replace(/\s+/g,' ').trim(); if(!CY.test(seg))return;
  // strip leading/trailing punctuation-only? keep
  if(!out.has(seg)) out.set(seg,new Set()); out.get(seg).add(file);}
function attrs(s,file){ for(const m of s.matchAll(/(?:aria-label|placeholder|title|alt|data-ph)="([^"]*)"/g)) add(m[1],file); }
function splitHtml(s,file){ attrs(s,file); for(const part of s.split(/<[^>]*>|&nbsp;|\n/)) { add(part,file);} }
for(const f of files){ const src=fs.readFileSync(dir+'/'+f,'utf8');
  let ast; try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script',allowHashBang:true})}catch(e){console.error('PARSE',f,e.message);continue}
  walk.fullAncestor(ast,(node,anc)=>{
    const par=anc[anc.length-2];
    if(par&&par.type==='Property'&&par.key&&(par.key.name==='description'||par.key.value==='description')&&par.value===node) return;
    if(node.type==='Literal'&&typeof node.value==='string'){ if(node.value.length>400) return; splitHtml(node.value,f);}
    else if(node.type==='TemplateLiteral'){ let s=''; node.quasis.forEach((q,i)=>{ s+=q.value.cooked??q.value.raw; if(i<node.expressions.length) s+='\u0001';});
      if(s.length>1500) return;
      { let k=0; attrs(s.replace(/\u0001/g,()=>'{'+(k++)+'}'),f); }
      for(const part of s.split(/<[^>]*>|&nbsp;|\n/)){ let k=0; const seg=part.replace(/\u0001/g,()=>'{'+(k++)+'}'); add(seg,f);} }
  });
}
const arr=[...out.keys()];
fs.writeFileSync(process.env.OUT,JSON.stringify(arr,null,0));
console.log(arr.length, arr.reduce((a,s)=>a+s.length,0));
