// Математика руху: усе — чисті функції часу t (секунди), тож будь-який кадр можна порахувати окремо.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,u)=>a+(b-a)*u;
const E={
  lin:x=>x,
  in:x=>x*x*x,
  out:x=>1-Math.pow(1-x,3),
  out4:x=>1-Math.pow(1-x,4),                                  // «приїхало й м'яко стало» — текст, картки
  inOut:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,               // типовий перехід між позами
  sine:x=>.5-.5*Math.cos(Math.PI*x),
  back:x=>1+2.70158*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2),  // легкий перельот — руки, поява елементів
  back3:x=>1+4*Math.pow(x-1,3)+3*Math.pow(x-1,2),             // сильний перельот — «вискочило»
};
// прогрес 0→1 між моментами a і b
const prog=(t,a,b,e=E.inOut)=>e(clamp((t-a)/(b-a)));
// доріжка ключів: [[час, значення, easing приходу в цей ключ], ...]
function kf(t,keys){
  if(t<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const [t0,v0]=keys[i-1],[t1,v1,e=E.inOut]=keys[i];
    return lerp(v0,v1,e(clamp((t-t0)/(t1-t0))));
  }
  return keys[keys.length-1][1];
}
// кліпання в задані моменти (0 — очі відкриті, 1 — закриті)
const blinkAt=(t,times)=>Math.max(0,...times.map(b=>{const u=(t-b)/.16;return u>0&&u<1?Math.sin(Math.PI*u):0}));
// фонове кліпання кожні ~3,3 с — щоб персонаж не «завмирав»
const autoBlink=t=>{const u=(((t+.9)%3.3)+3.3)%3.3/.16;return u<1?Math.sin(Math.PI*u):0;};
// стрибок: присідання (anti) → політ (dur, висота h) → приземлення з відскоком.
// Повертає зсув по вертикалі dy (вгору — від'ємний) і вертикальний масштаб sy (squash & stretch).
function jump(t,{t0,dur,h,anti=.2,squash=.12,stretch=.04}){
  const te=t0+dur;let dy=0,sy=1;
  if(t<t0)sy=kf(t,[[t0-anti,1],[t0-anti*.3,1-squash*.8,E.out],[t0,1+stretch,E.in]]);
  else if(t<te){const u=(t-t0)/dur;dy=-h*4*u*(1-u);sy=1+stretch*Math.pow(Math.abs(2*u-1),1.5);}
  else sy=kf(t,[[te,1+stretch],[te+.07,1-squash,E.out],[te+.21,1+squash*.32],[te+.36,1-squash*.1],[te+.5,1]]);
  return {dy,sy};
}
// помах рукою: відхилення кута руки в градусах (замах усередину → swings махів → повернення)
function wave(t,t0,swings=4,sw=.27){
  const u=t-t0;if(u<0)return 0;if(u<.2)return lerp(0,-26,E.out(u/.2));
  const k=(u-.2)/sw;if(k<swings){const i=Math.floor(k),f=E.sine(k-i);return i%2?lerp(12,-26,f):lerp(-26,12,f);}
  const v=(u-.2-swings*sw)/.32,last=swings%2?12:-26;return v<1?lerp(last,0,E.back(v)):0;
}
// затухаюче коливання (для «?», корони, руки після удару)
const wobble=(t,t0,amp,freq=2.4,decay=4.2)=>{const u=t-t0;return u>0&&u<1.2?amp*Math.sin(2*Math.PI*freq*u)*Math.exp(-decay*u):0;};
// предмет, що падає й відскакує від підлоги, а потім котиться. Повертає {at(t)→{x,y}, hits:[[час,x],...]}
function bounce({p0,v,floor,g,t0=0,dur=10,e=.55,fr=.66,roll=4.5,fps=30}){
  const sim=[],hits=[];let [x,y]=p0,[vx,vy]=v,rolling=false;const dt=1/1200,step=Math.round(1200/fps);
  for(let i=0,tt=t0;tt<=t0+dur+.01;i++,tt+=dt){
    if(i%step===0)sim.push([x,y]);
    if(rolling){vx*=Math.exp(-roll*dt);x+=vx*dt;continue;}
    vy+=g*dt;x+=vx*dt;y+=vy*dt;
    if(y>=floor&&vy>0){y=floor;hits.push([tt,x]);vy*=-e;vx*=fr;if(Math.abs(vy)<g*.053){rolling=true;vy=0;}}
  }
  const at=t=>{const f=(t-t0)*fps,i=Math.max(0,Math.min(sim.length-2,Math.floor(f))),u=clamp(f-i);return {x:lerp(sim[i][0],sim[i+1][0],u),y:lerp(sim[i][1],sim[i+1][1],u)};};
  return {at,hits,rest:sim[sim.length-1]};
}
// політ із точки p0 в точку p1 за час T під гравітацією g (підкинула — спіймала)
const arc=(p0,p1,T,g)=>u=>{const vy=(p1[1]-p0[1]-.5*g*T*T)/T;return {x:lerp(p0[0],p1[0],u/T),y:p0[1]+vy*u+.5*g*u*u};};

module.exports={clamp,lerp,E,prog,kf,blinkAt,autoBlink,jump,wave,wobble,bounce,arc};
