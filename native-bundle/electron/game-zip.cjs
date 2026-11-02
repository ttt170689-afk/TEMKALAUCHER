'use strict';
// Bounded ZIP32 extraction. No shell/PowerShell, symlinks, arbitrary paths or ZIP64.
const fs=require('./game-fs.cjs'),p=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {Transform}=require('node:stream');const {pipeline}=require('node:stream/promises');
function safeName(name){
 if(typeof name!=='string'||name.length>220||!name||name.includes('\\')||name.startsWith('/')||name.includes('//')||/[\x00-\x1f<>:"|?*]/.test(name))throw Error('Небезопасное имя файла игры.');
 const parts=name.replace(/\/$/,'').split('/');
 if(parts.some(x=>!x||x==='.'||x==='..'||/[ .]$/.test(x)||/^(CON|PRN|AUX|NUL|COM[0-9¹²³]|LPT[0-9¹²³])($|\.)/i.test(x)))throw Error('Небезопасный путь игры.');return name;
}
async function readAt(handle,offset,length){const b=Buffer.alloc(length);const {bytesRead}=await handle.read(b,0,length,offset);if(bytesRead!==length)throw Error('Оборванный ZIP игры.');return b;}
async function directory(file){
 const h=await fs.promises.open(file,'r');try{
  const size=(await h.stat()).size;if(size<22||size>200*1024*1024)throw Error('Неверный размер ZIP игры.');const tail=await readAt(h,Math.max(0,size-65557),Math.min(size,65557));
  let end=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
  if(end<0||tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6))throw Error('Неподдерживаемый ZIP игры.');
  const count=tail.readUInt16LE(end+10),bytes=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);
  if(!count||count>256||bytes>1024*1024||offset+bytes>size-22)throw Error('Лимиты ZIP игры превышены.');
  const cd=await readAt(h,offset,bytes),entries=[],seen=new Set();let pos=0,total=0;
  for(let i=0;i<count;i++){
   if(pos+46>cd.length||cd.readUInt32LE(pos)!==0x02014b50)throw Error('Повреждённый каталог ZIP.');
   const flags=cd.readUInt16LE(pos+8),method=cd.readUInt16LE(pos+10),compressed=cd.readUInt32LE(pos+20),length=cd.readUInt32LE(pos+24),nl=cd.readUInt16LE(pos+28),el=cd.readUInt16LE(pos+30),cl=cd.readUInt16LE(pos+32),attributes=cd.readUInt32LE(pos+38),local=cd.readUInt32LE(pos+42);
   const next=pos+46+nl+el+cl;if(next>cd.length)throw Error('Повреждённый каталог ZIP.');
   const name=safeName(cd.subarray(pos+46,pos+46+nl).toString('utf8')),key=name.replace(/\/$/,'').toLowerCase(),type=(attributes>>>16)&0xf000;
   if(seen.has(key)||flags&1||![0,8].includes(method)||![0,0x4000,0x8000].includes(type)||length>300*1024*1024||compressed===0xffffffff||local+30+compressed>offset)throw Error('Неподдерживаемая запись ZIP игры.');
   seen.add(key);total+=length;if(total>800*1024*1024)throw Error('Распакованная игра слишком велика.');
   entries.push({name,method,compressed,length,local,flags});pos=next;
  }
  if(pos!==cd.length)throw Error('Лишние данные каталога ZIP.');return entries;
 }finally{await h.close();}
}
async function extract(file,destination,{only=null}={}){
 const entries=await directory(file);if(only&&entries.some(e=>!only.includes(e.name)))throw Error('Неожиданный состав внешнего артефакта.');
 const hashes=Object.create(null);await fs.promises.mkdir(destination,{recursive:true,mode:0o700});const h=await fs.promises.open(file,'r');
 try{for(const e of entries){
  const target=p.resolve(destination,e.name);if(!target.startsWith(p.resolve(destination)+p.sep))throw Error('Выход за папку игры.');
  if(e.name.endsWith('/')){await fs.promises.mkdir(target,{recursive:true,mode:0o700});continue;}
  await fs.promises.mkdir(p.dirname(target),{recursive:true,mode:0o700});
  const lh=await readAt(h,e.local,30);if(lh.readUInt32LE(0)!==0x04034b50||lh.readUInt16LE(8)!==e.method)throw Error('Повреждённый заголовок ZIP.');
  const nl=lh.readUInt16LE(26),el=lh.readUInt16LE(28),name=(await readAt(h,e.local+30,nl)).toString('utf8');if(name!==e.name)throw Error('Имена ZIP не совпадают.');
  const begin=e.local+30+nl+el;let written=0;const hash=crypto.createHash('sha256');
  const counter=new Transform({transform(chunk,_encoding,callback){written+=chunk.length;if(written>e.length)return callback(Error('Неверный размер распаковки.'));hash.update(chunk);callback(null,chunk);}});
  if(e.compressed===0){if(e.length!==0)throw Error('Пустая повреждённая запись.');await fs.promises.writeFile(target,'',{flag:'wx',mode:0o600});}else{const streams=[fs.createReadStream(file,{start:begin,end:begin+e.compressed-1})];if(e.method===8)streams.push(zlib.createInflateRaw());streams.push(counter,fs.createWriteStream(target,{flags:'wx',mode:0o600}));await pipeline(...streams);}
  if(written!==e.length)throw Error('Оборванная распаковка игры.');hashes[e.name]={bytes:written,sha256:hash.digest('hex')};
 }}finally{await h.close();}return hashes;
}
async function fileHash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
module.exports={safeName,directory,extract,fileHash};
