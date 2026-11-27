// Звук без бібліотек: тиха фонова музика й короткі ефекти синтезуються в Node і пишуться у WAV (24 кГц, моно — як озвучка в mixdown).
// music(dur) — лагідний луп 92 bpm (клавіші Cmaj7 → Am7 → Dm7 → G7sus, бас, пластинки-підголоски, шейкер);
// sfx(name) — 'hop' (відрив), 'land' (приземлення), 'pop' (поява), 'chime' (готово), 'whoosh' (перехід). Файли кешуються в out/sound/.
// Ліцензій і стоків не треба: усе згенеровано кодом.
const fs=require('fs'),path=require('path');
const SR=24000,DIR=path.join(__dirname,'..','out','sound');

function writeWav(file,data){
  let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));const k=peak>0?.9/peak:1;
  const buf=Buffer.alloc(44+data.length*2);
  buf.write('RIFF',0);buf.writeUInt32LE(36+data.length*2,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);
  buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(data.length*2,40);
  for(let i=0;i<data.length;i++)buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,data[i]*k))*32767),44+i*2);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buf);return file;
}
const hz=m=>440*Math.pow(2,(m-69)/12);
// детермінований «випадок», щоб музика щоразу була однакова
const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(7);
// нота: тон із кількох гармонік, атака й експоненційне згасання
function note(out,t0,f,{vel=.3,decay=2,len=1.6,harm=[1,.3,.1],attack=.008}){
  const i0=Math.floor(t0*SR),n=Math.floor(len*SR);
  for(let i=0;i<n&&i0+i<out.length;i++){const t=i/SR,env=Math.min(1,t/attack)*Math.exp(-t*decay);let v=0;
    harm.forEach((a,h)=>{v+=a*Math.sin(2*Math.PI*f*(h+1)*t);});out[i0+i]+=vel*env*v;}
}

function music(dur){
  const file=path.join(DIR,`music-${dur.toFixed(1)}.wav`);if(fs.existsSync(file))return file;
  const out=new Float32Array(Math.ceil(dur*SR)),beat=60/92,bar=beat*4;
  const CH=[[60,64,67,71],[57,60,64,67],[62,65,69,72],[55,60,62,65]],ROOT=[36,33,38,31],PENTA=[72,74,76,79,81,84];
  for(let b=0;b*bar<dur;b++){const c=CH[b%4],t=b*bar;
    for(const m of c){note(out,t,hz(m),{vel:.09,decay:1.6,len:2.4});note(out,t+beat*2.5,hz(m),{vel:.05,decay:2.2,len:1.6});}
    note(out,t,hz(ROOT[b%4]),{vel:.22,decay:3,len:1.2,harm:[1,.2]});note(out,t+beat*2,hz(ROOT[b%4]),{vel:.16,decay:3.5,len:1});
    for(let q=0;q<8;q++)if(rnd()<.45)note(out,t+q*beat/2,hz(PENTA[Math.floor(rnd()*PENTA.length)]),{vel:.045,decay:7,len:.6,harm:[1,.15]});
    for(let q=0;q<8;q++){const i0=Math.floor((t+q*beat/2)*SR),acc=q%2?.035:.018;let prev=0;
      for(let i=0;i<SR*.05&&i0+i<out.length;i++){const w=rnd()*2-1,hp=w-prev;prev=w;out[i0+i]+=acc*hp*Math.exp(-i/SR*70);}}
  }
  // тепліше: однополюсний фільтр нижніх частот, плавний вхід і вихід
  let y=0;const a=1-Math.exp(-2*Math.PI*4200/SR);for(let i=0;i<out.length;i++){y+=a*(out[i]-y);out[i]=y;}
  for(let i=0;i<out.length;i++){const t=i/SR;out[i]*=Math.min(1,t/1.5)*Math.min(1,(dur-t)/2.5);}
  return writeWav(file,out);
}

// частота, що змінюється в часі: f(t) → фаза накопичується
function sweep(len,f,env){const out=new Float32Array(Math.ceil(len*SR));let ph=0;
  for(let i=0;i<out.length;i++){const t=i/SR;ph+=2*Math.PI*f(t/len)/SR;out[i]=Math.sin(ph)*env(t/len,t);}return out;}
const SFX={
  hop:()=>sweep(.16,u=>320+620*u*u,(u,t)=>Math.min(1,t/.006)*(1-u)),
  land:()=>{const a=sweep(.14,u=>150-80*u,(u,t)=>Math.min(1,t/.003)*Math.exp(-t*30));for(let i=0;i<a.length*.3;i++)a[i]+=.25*(rnd()*2-1)*Math.exp(-i/SR*120);return a;},
  pop:()=>sweep(.08,u=>620+700*u,(u,t)=>Math.min(1,t/.003)*Math.exp(-t*45)),
  chime:()=>{const out=new Float32Array(Math.ceil(.7*SR));note(out,0,1318.5,{vel:.5,decay:6,len:.7,harm:[1,.1]});note(out,.06,1760,{vel:.4,decay:6,len:.64,harm:[1,.1]});return out;},
  whoosh:()=>{const len=.6,out=new Float32Array(Math.ceil(len*SR));let y=0;
    for(let i=0;i<out.length;i++){const u=i/out.length,a=1-Math.exp(-2*Math.PI*(300+2600*Math.sin(Math.PI*u))/SR);y+=a*((rnd()*2-1)-y);out[i]=y*Math.sin(Math.PI*u);}return out;},
};
function sfx(name){const file=path.join(DIR,`sfx-${name}.wav`);if(fs.existsSync(file))return file;return writeWav(file,SFX[name]());}

module.exports={SR,music,sfx,writeWav};
