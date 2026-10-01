import * as THREE from 'three';

/* ============================== Config ============================== */
const DX = 64, DY = 48, DZ = 64;      // world size
const CHUNK = 16;
const SEA = 14;
const SAVE_KEY = 'blockcraft-save-v1';

const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, LOG=5, LEAF=6,
      PLANK=7, GLASS=8, BRICK=9, WATER=10, BEDROCK=12, COAL=13;

const HOTBAR = [
  {id:GRASS,name:'Grass'},{id:DIRT,name:'Dirt'},{id:STONE,name:'Stone'},
  {id:PLANK,name:'Planks'},{id:LOG,name:'Wood'},{id:LEAF,name:'Leaves'},
  {id:SAND,name:'Sand'},{id:GLASS,name:'Glass'},{id:BRICK,name:'Brick'},
];
const FACES = {
  [GRASS]:{top:0,side:1,bottom:2}, [DIRT]:{all:2}, [STONE]:{all:3},
  [SAND]:{all:4}, [LOG]:{top:6,bottom:6,side:5}, [LEAF]:{all:7},
  [PLANK]:{all:8}, [GLASS]:{all:9}, [BRICK]:{all:10}, [WATER]:{all:11},
  [BEDROCK]:{all:12}, [COAL]:{all:13},
};
const OPAQUE = new Set([GRASS,DIRT,STONE,SAND,LOG,LEAF,PLANK,BRICK,BEDROCK,COAL]);
const isOpaque = id => OPAQUE.has(id);
const isSel = id => id!==AIR && id!==WATER;

/* ============================== Utils ============================== */
const $ = s => document.querySelector(s);
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function toast(msg,ms=2200){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.add('hidden'),ms)}
function setLoad(p,txt){$('#load-fill').style.width=(p*100).toFixed(0)+'%';if(txt)$('#load-text').textContent=txt}

/* value noise */
function makeNoise(rand){
  const perm=new Uint8Array(512); const p=[...Array(256).keys()];
  for(let i=255;i>0;i--){const j=(rand()*(i+1))|0;[p[i],p[j]]=[p[j],p[i]]}
  for(let i=0;i<512;i++)perm[i]=p[i&255];
  const grad=(h)=>h/255;
  function n2(x,z){
    const xi=Math.floor(x), zi=Math.floor(z);
    const xf=x-xi, zf=z-zi;
    const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
    const X=xi&255, Z=zi&255;
    const a=grad(perm[(perm[X]+Z)&511]), b=grad(perm[(perm[X+1&255])+Z&511]),
          c=grad(perm[(perm[X]+Z+1)&511]), d=grad(perm[(perm[X+1&255])+Z+1&511]);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; // 0..1
  }
  return n2;
}

/* ============================== Textures ============================== */
function speckle(ctx,rand,base,vars,n=90){
  ctx.fillStyle=base;ctx.fillRect(0,0,16,16);
  for(let i=0;i<n;i++){
    ctx.fillStyle=vars[(rand()*vars.length)|0];
    ctx.fillRect((rand()*16)|0,(rand()*16)|0,1+((rand()*2)|0),1);
  }
}
function makeAtlas(){
  const cv=document.createElement('canvas');cv.width=128;cv.height=128;
  const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
  const R=mulberry32(1337);
  const tile=(i,fn)=>{const ox=(i%8)*16,oy=((i/8)|0)*16;ctx.save();ctx.translate(ox,oy);ctx.beginPath();ctx.rect(0,0,16,16);ctx.clip();fn();ctx.restore();
    // return dataURL for icons
    const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').drawImage(cv,ox,oy,16,16,0,0,16,16);return c.toDataURL()};
  const urls={};
  urls[0]=tile(0,()=>speckle(ctx,R,'#6abe30',['#5da92a','#79d143','#4e9425','#8ae04f'],160));
  urls[2]=tile(2,()=>speckle(ctx,R,'#8a5a32',['#75502e','#9c6a3c','#6b4426','#a4764a'],150));
  urls[1]=tile(1,()=>{speckle(ctx,R,'#8a5a32',['#75502e','#9c6a3c','#6b4426'],120);
    ctx.fillStyle='#6abe30';ctx.fillRect(0,0,16,5);
    ctx.fillStyle='#5da92a';for(let x=0;x<16;x+=2)ctx.fillRect(x,5,1,1+((R()*3)|0));});
  urls[3]=tile(3,()=>speckle(ctx,R,'#8d8d94',['#7c7c83','#9d9da5','#6f6f76'],140));
  urls[4]=tile(4,()=>speckle(ctx,R,'#e0d29a',['#d3c288','#ecdfae','#c9b87e'],130));
  urls[5]=tile(5,()=>{ctx.fillStyle='#6b4a2a';ctx.fillRect(0,0,16,16);
    for(let x=0;x<16;x+=4){ctx.fillStyle='#4e3319';ctx.fillRect(x,0,2,16);ctx.fillStyle='#8a6238';ctx.fillRect(x+2,0,1,16);}});
  urls[6]=tile(6,()=>{ctx.fillStyle='#c8a86a';ctx.fillRect(0,0,16,16);ctx.strokeStyle='#6b4a2a';
    for(let r=1;r<4;r++){ctx.strokeRect(r,r,16-2*r,16-2*r)}});
  urls[7]=tile(7,()=>{speckle(ctx,R,'#2f7a26',['#25631e','#3a9440','#1e4f18','#4fae4a'],170);
    ctx.fillStyle='#14300f';for(let i=0;i<14;i++)ctx.fillRect((R()*16)|0,(R()*16)|0,2,2)});
  urls[8]=tile(8,()=>{ctx.fillStyle='#b08a4f';ctx.fillRect(0,0,16,16);
    ctx.fillStyle='#8a6238';for(let y=3;y<16;y+=4)ctx.fillRect(0,y,16,1);
    ctx.fillRect(7,0,1,16);ctx.fillStyle='#d3ab68';for(let y=0;y<16;y+=4)ctx.fillRect(0,y,16,1)});
  urls[9]=tile(9,()=>{ctx.clearRect(0,0,16,16);ctx.fillStyle='rgba(200,235,245,0.55)';ctx.fillRect(0,0,16,16);
    ctx.strokeStyle='#eef7fa';ctx.lineWidth=2;ctx.strokeRect(1,1,14,14);
    ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillRect(3,9,2,4);ctx.fillRect(9,3,4,2)});
  urls[10]=tile(10,()=>{ctx.fillStyle='#9e4a3c';ctx.fillRect(0,0,16,16);
    ctx.fillStyle='#c9c9c9';ctx.fillRect(0,3,16,1);ctx.fillRect(0,7,16,1);ctx.fillRect(0,11,16,1);ctx.fillRect(0,15,16,1);
    ctx.fillRect(7,0,1,3);ctx.fillRect(3,4,1,3);ctx.fillRect(11,4,1,3);ctx.fillRect(7,8,1,3);ctx.fillRect(3,12,1,3);ctx.fillRect(11,12,1,3)});
  urls[11]=tile(11,()=>speckle(ctx,R,'#3b6fe0',['#2f5cc4','#4f86f2','#3563d6'],100));
  urls[12]=tile(12,()=>speckle(ctx,R,'#3a3a3f',['#232327','#55555c','#101013'],160));
  urls[13]=tile(13,()=>{speckle(ctx,R,'#8d8d94',['#7c7c83','#9d9da5'],110);
    ctx.fillStyle='#17171a';[[3,3],[9,5],[5,10],[11,11],[7,7]].forEach(([x,y])=>ctx.fillRect(x,y,3,3))});
  const tex=new THREE.CanvasTexture(cv);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  tex.colorSpace=THREE.SRGBColorSpace;
  return {tex,urls};
}
function tileUV(t){
  const c=t%8, r=(t/8)|0, S=1/8, pad=0.5/128;
  // canvas row 0 at top -> v top
  const u0=c*S+pad, u1=(c+1)*S-pad;
  const v1=1-r*S-pad, v0=1-(r+1)*S+pad;
  return [u0,v0,u1,v1];
}

/* ============================== World data ============================== */
const world=new Uint8Array(DX*DY*DZ);
const idx=(x,y,z)=>(y*DZ+z)*DX+x;
const inB=(x,y,z)=>x>=0&&z>=0&&y>=0&&x<DX&&z<DZ&&y<DY;
function getB(x,y,z){return inB(x,y,z)?world[idx(x,y,z)]:AIR}
function setB(x,y,z,v){if(inB(x,y,z))world[idx(x,y,z)]=v}

let seedStr='';
function heightsFor(seed){
  const rand=mulberry32(hashStr(seed||'blockcraft'));
  const n=makeNoise(rand);
  const H=new Int16Array(DX*DZ);
  for(let x=0;x<DX;x++)for(let z=0;z<DZ;z++){
    const s1=n(x*0.045+13.7,z*0.045+7.1);
    const s2=n(x*0.13+3.3,z*0.13+29.9);
    const m=Math.sin(x*0.15)*Math.cos(z*0.13)*0.5+0.5;
    let h=Math.floor(11+s1*11+s2*3.4+m*2.2);
    h=Math.max(4,Math.min(DY-12,h));
    H[z*DX+x]=h;
  }
  return {H,rand};
}
async function generate(seed,onp){
  seedStr=seed;
  world.fill(AIR);
  const {H,rand}=heightsFor(seed);
  const total=DX*DZ;
  for(let x=0;x<DX;x++)for(let z=0;z<DZ;z++){
    const h=H[z*DX+x];
    for(let y=0;y<=h;y++){
      let b;
      if(y===0)b=BEDROCK;
      else if(y===h){
        if(h<=SEA+1)b=(h<SEA-1)?DIRT:SAND;
        else b=GRASS;
      }
      else if(y>h-4)b=(h<=SEA+1)?SAND:DIRT;
      else b=(rand()<0.03)?COAL:STONE;
      // sandy seafloor
      if(h<SEA-1&&y>h-3)b=SAND;
      setB(x,y,z,b);
    }
    if(h<SEA)for(let y=h+1;y<=SEA;y++)setB(x,y,z,WATER);
    if((x*DZ+z)%97===0)await onp?.((x*DZ+z)/total*0.6);
  }
  // trees
  let placed=0,tries=0;
  while(placed<46&&tries<900){
    tries++;
    const x=3+((rand()*(DX-6))|0), z=3+((rand()*(DZ-6))|0);
    const h=H[z*DX+x];
    if(h<=SEA+1||getB(x,h,z)!==GRASS)continue;
    // spacing check
    let ok=true;
    for(let dx=-2;dx<=2&&ok;dx++)for(let dz=-2;dz<=2&&ok;dz++)
      if(getB(x+dx,h+4,z+dz)===LOG)ok=false;
    if(!ok)continue;
    const th=4+((rand()*2)|0);
    for(let y=h+1;y<=h+th;y++)setB(x,y,z,LOG);
    for(let dy=th-2;dy<=th+1;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      if(Math.abs(dx)===2&&Math.abs(dz)===2&&rand()<0.6)continue;
      if(dy===th+1&&(Math.abs(dx)>1||Math.abs(dz)>1))continue;
      const px=x+dx,py=h+dy,pz=z+dz;
      if(inB(px,py,pz)&&getB(px,py,pz)===AIR)setB(px,py,pz,LEAF);
    }
    setB(x,h+th+1,z,LEAF);
    placed++;
    if(tries%8===0)await onp?.(0.6+0.2*(placed/46));
  }
  await onp?.(0.85);
}

/* ============================== Three setup ============================== */
const canvas=$('#game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.Fog(0x87ceeb,40,140);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,600);

scene.add(new THREE.HemisphereLight(0xdff3ff,0x6b5a3e,0.95));
const sun=new THREE.DirectionalLight(0xfff6d8,1.6);sun.position.set(40,70,20);scene.add(sun);

const {tex:atlasTex,urls:iconURLs}=makeAtlas();
const matOpaque=new THREE.MeshLambertMaterial({map:atlasTex,vertexColors:true});
const matTrans=new THREE.MeshLambertMaterial({map:atlasTex,vertexColors:true,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide,alphaTest:0.05});

/* clouds */
const clouds=new THREE.Group();clouds.position.set(-DX/2,0,-DZ/2);scene.add(clouds);
{
  const g=new THREE.BoxGeometry(1,1,1);
  const m=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75});
  const R=mulberry32(42);
  for(let i=0;i<22;i++){
    const w=6+R()*10,d=4+R()*8;
    const c=new THREE.Mesh(g,m);c.scale.set(w,1.2,d);
    c.position.set(R()*DX*1.6-DX*0.3,36+R()*5,R()*DZ*1.6-DZ*0.3);
    clouds.add(c);
  }
}

/* highlight box */
const hl=new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)),
  new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:0.7}));
hl.visible=false;scene.add(hl);

/* particles */
const particles=[];
const partGeo=new THREE.BoxGeometry(0.12,0.12,0.12);
function burst(x,y,z,colorHex){
  const m=new THREE.MeshBasicMaterial({color:colorHex});
  for(let i=0;i<14;i++){
    const p=new THREE.Mesh(partGeo,m);
    p.position.set(x+0.2+Math.random()*0.6,y+0.2+Math.random()*0.6,z+0.2+Math.random()*0.6);
    p.userData.v=new THREE.Vector3((Math.random()-0.5)*4,Math.random()*4.5,(Math.random()-0.5)*4);
    p.userData.life=0.5+Math.random()*0.4;
    scene.add(p);particles.push(p);
  }
}
const BLOCK_COLOR={1:0x6abe30,2:0x8a5a32,3:0x8d8d8d,4:0xe0d29a,5:0x6b4a2a,6:0x2f7a26,7:0xb08a4f,8:0xcfeaf2,9:0x9e4a3c,12:0x3a3a3f,13:0x55555c};

/* audio */
let AC=null;
function sfx(freq=440,dur=0.08,type='square',vol=0.12){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type;o.frequency.value=freq;g.gain.value=vol;
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur);
    o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+dur);
  }catch{}
}

/* ============================== Meshing ============================== */
const chunkMeshes=new Map();
function chunkKey(cx,cz){return cx+','+cz}
function disposeChunk(k){
  const e=chunkMeshes.get(k);if(!e)return;
  e.group.traverse(o=>{if(o.geometry)o.geometry.dispose()});
  scene.remove(e.group);chunkMeshes.delete(k);
}
const FACE_DEF=[
  {d:[0,1,0], s:1.0, c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]], k:'top'},
  {d:[0,-1,0],s:0.55,c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], k:'bottom'},
  {d:[1,0,0], s:0.8, c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], k:'side'},
  {d:[-1,0,0],s:0.8, c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], k:'side'},
  {d:[0,0,1], s:0.7, c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], k:'side'},
  {d:[0,0,-1],s:0.7, c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], k:'side'},
];
function tileFor(id,kind){
  const f=FACES[id];if(!f)return 3;
  if(f.all!==undefined)return f.all;
  return kind==='top'?f.top:kind==='bottom'?f.bottom:f.side;
}
function buildChunk(cx,cz){
  const k=chunkKey(cx,cz);disposeChunk(k);
  const group=new THREE.Group();
  const O={pos:[],nrm:[],uv:[],col:[],idx:[]};
  const T={pos:[],nrm:[],uv:[],col:[],idx:[]};
  const x0=cx*CHUNK,z0=cz*CHUNK;
  for(let x=x0;x<x0+CHUNK;x++)for(let z=z0;z<z0+CHUNK;z++)for(let y=0;y<DY;y++){
    const id=getB(x,y,z);if(id===AIR)continue;
    const trans=!isOpaque(id);
    const A=trans?T:O;
    for(const f of FACE_DEF){
      const nx=x+f.d[0],ny=y+f.d[1],nz=z+f.d[2];
      const n=inB(nx,ny,nz)?getB(nx,ny,nz):AIR;
      if(id===WATER){
        if(n===WATER)continue;
        if(f.k!=='top'&&isOpaque(n))continue;
        if(f.k==='top'&&n!==AIR)continue;
      }else if(trans){
        if(n===id)continue;
        if(isOpaque(n))continue;
      }else{
        if(n!==AIR&&isOpaque(n))continue;
        if(n===id)continue;
      }
      if(n===WATER&&id!==WATER&&!trans)continue; // hide faces under water sides? keep top visible
      const t=tileFor(id,f.k);
      const [u0,v0,u1,v1]=tileUV(t);
      const base=A.pos.length/3;
      const sh=f.s*(id===WATER?0.95:1);
      for(let i=0;i<4;i++){
        let vx=x+f.c[i][0],vy=y+f.c[i][1],vz=z+f.c[i][2];
        if(id===WATER&&f.k==='top')vy-=0.15;
        A.pos.push(vx,vy,vz);A.nrm.push(...f.d);
        A.uv.push(i===0?u0:i===1?u0:i===2?u1:u1, i===0?v1:i===1?v0:i===2?v0:v1);
        A.col.push(sh,sh,sh);
      }
      A.idx.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  const mk=(a,mat)=>{
    if(!a.idx.length)return null;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(a.pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(a.nrm,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(a.col,3));
    g.setIndex(a.idx);
    const mesh=new THREE.Mesh(g,mat);group.add(mesh);return mesh;
  };
  mk(O,matOpaque);mk(T,matTrans);
  // shift world to center at origin for nicer orbit
  group.position.set(-DX/2,0,-DZ/2);
  scene.add(group);
  chunkMeshes.set(k,{group});
}
function remeshAll(){for(let cx=0;cx<DX/CHUNK;cx++)for(let cz=0;cz<DZ/CHUNK;cz++)buildChunk(cx,cz)}
function remeshAround(x,z){
  const cx=(x/CHUNK)|0,cz=(z/CHUNK)|0;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const ax=cx+dx,az=cz+dz;
    if(ax>=0&&az>=0&&ax<DX/CHUNK&&az<DZ/CHUNK)buildChunk(ax,az);
  }
}
// world offset: keep logic coords, render group offset — raycast/physics use logic coords,
// so meshes need offset compensation: we offset group, so set mesh matrix accordingly.
// Simpler: keep an outer offset group
const worldOffset=new THREE.Vector3(-DX/2,0,-DZ/2);

/* ============================== Player ============================== */
const player={pos:new THREE.Vector3(DX/2,24,DZ/2),vel:new THREE.Vector3(),yaw:0.6,pitch:-0.15,onGround:false,fly:false};
const EYE=1.62, PR=0.32, PH=1.8;
function solidAt(x,y,z){
  const b=getB(Math.floor(x),Math.floor(y),Math.floor(z));
  return isOpaque(b);
}
function collides(px,py,pz){
  const r=PR,h=PH;
  const x0=Math.floor(px-r),x1=Math.floor(px+r);
  const y0=Math.floor(py),y1=Math.floor(py+h-0.001);
  const z0=Math.floor(pz-r),z1=Math.floor(pz+r);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){
    const b=getB(x,y,z);
    if(!isOpaque(b))continue;
    if(px+r>x&&px-r<x+1&&py+h>y&&py<y+1&&pz+r>z&&pz-r<z+1)return true;
  }
  return false;
}
function spawn(){
  const {H}=heightsFor(seedStr||'blockcraft');
  // find safe open spot near center
  let sx=(DX/2)|0, sz=(DZ/2)|0, done=false;
  outer:
  for(let r=0;r<24;r++){
    for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
      const x=sx+dx,z=sz+dz;
      if(x<2||z<2||x>=DX-2||z>=DZ-2)continue;
      const h=H[z*DX+x];
      if(h<=SEA)continue;
      const top=getB(x,h,z);
      if(top!==GRASS&&top!==SAND&&top!==DIRT)continue;
      if(getB(x,h+1,z)!==AIR||getB(x,h+2,z)!==AIR||getB(x,h+3,z)!==AIR)continue;
      sx=x;sz=z;done=true;break outer;
    }
  }
  const h=H[sz*DX+sx]||16;
  player.pos.set(sx+0.5,h+2.05,sz+0.5);
  player.vel.set(0,0,0);player.fly=false;
  player.yaw=Math.PI*0.25;player.pitch=-0.08;
  $('#fly-tag')?.classList.add('hidden');
}
function inWater(){
  const b=getB(Math.floor(player.pos.x),Math.floor(player.pos.y+0.4),Math.floor(player.pos.z));
  return b===WATER;
}

/* ============================== Input ============================== */
const keys={};
let state='boot'; // boot | menu | playing | paused
let selected=0;
addEventListener('keydown',e=>{
  if(e.target&&/INPUT/.test(e.target.tagName))return;
  keys[e.code]=true;
  if(state==='playing'){
    if(e.code==='Digit1')select(0);if(e.code==='Digit2')select(1);if(e.code==='Digit3')select(2);
    if(e.code==='Digit4')select(3);if(e.code==='Digit5')select(4);if(e.code==='Digit6')select(5);
    if(e.code==='Digit7')select(6);if(e.code==='Digit8')select(7);if(e.code==='Digit9')select(8);
    if(e.code==='KeyF'){player.fly=!player.fly;player.vel.y=0;$('#fly-tag').classList.toggle('hidden',!player.fly);toast(player.fly?'Flying enabled':'Flying disabled');sfx(660,0.08,'sine')}
    if(e.code==='Space'&&player.fly)e.preventDefault();
  }
});
addEventListener('keyup',e=>keys[e.code]=false);

let locked=false;
canvas.addEventListener('click',()=>{
  if(state==='playing'&&!locked&&!isTouch){canvas.requestPointerLock?.()}
});
document.addEventListener('pointerlockchange',()=>{
  locked=document.pointerLockElement===canvas;
  if(!locked&&state==='playing'&&!isTouch&&startedOnce)showPause();
});
addEventListener('mousemove',e=>{
  if(state!=='playing')return;
  if(locked||dragLook){
    player.yaw-=e.movementX*0.0026;
    player.pitch-=e.movementY*0.0026;
    player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch));
  }
});
// fallback drag-look when pointer lock unavailable
let dragLook=false,dragBtn=-1;
canvas.addEventListener('mousedown',e=>{
  if(state!=='playing')return;
  if(!locked){dragLook=true;dragBtn=e.button}
  if(e.button===0)startMine();else if(e.button===2)doPlace();
});
addEventListener('mouseup',e=>{if(e.button===dragBtn){dragLook=false;dragBtn=-1}if(e.button===0)stopMine()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{
  if(state!=='playing')return;
  select((selected+(e.deltaY>0?1:-1)+9)%9);
},{passive:true});

/* mining hold */
let mineTimer=null,lastTarget=null;
function startMine(){doBreak();stopMine();mineTimer=setInterval(doBreak,230)}
function stopMine(){clearInterval(mineTimer);mineTimer=null}

/* ============================== Raycast ============================== */
function raycast(maxD=7){
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'));
  let x=player.pos.x,y=player.pos.y+EYE,z=player.pos.z;
  const dx=dir.x,dy=dir.y,dz=dir.z;
  let ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  const stx=dx>0?1:-1,sty=dy>0?1:-1,stz=dz>0?1:-1;
  const tdx=Math.abs(1/(dx||1e-9)),tdy=Math.abs(1/(dy||1e-9)),tdz=Math.abs(1/(dz||1e-9));
  let tmx=(dx>0?(ix+1-x):(x-ix))*tdx;
  let tmy=(dy>0?(iy+1-y):(y-iy))*tdy;
  let tmz=(dz>0?(iz+1-z):(z-iz))*tdz;
  let nx=0,ny=0,nz=0,t=0;
  for(let i=0;i<64;i++){
    if(tmx<tmy&&tmx<tmz){ix+=stx;t=tmx;tmx+=tdx;nx=-stx;ny=0;nz=0}
    else if(tmy<tmz){iy+=sty;t=tmy;tmy+=tdy;nx=0;ny=-sty;nz=0}
    else{iz+=stz;t=tmz;tmz+=tdz;nx=0;ny=0;nz=-stz}
    if(t>maxD)return null;
    const b=getB(ix,iy,iz);
    if(b!==AIR&&b!==WATER)return {x:ix,y:iy,z:iz,nx,ny,nz,id:b};
  }
  return null;
}
function doBreak(){
  if(state!=='playing')return;
  const t=raycast();lastTarget=t;
  if(!t)return;
  if(t.id===BEDROCK){toast('Bedrock cannot be mined');return}
  setB(t.x,t.y,t.z,AIR);remeshAround(t.x,t.z);
  burst(t.x+worldOffset.x,t.y,t.z+worldOffset.z,BLOCK_COLOR[t.id]??0xffffff);
  // fix particle offset (world rendered with offset)
  sfx(180+Math.random()*120,0.07,'square',0.1);
  dirtySave();
}
function doPlace(){
  if(state!=='playing')return;
  const t=raycast();if(!t)return;
  const px=t.x+t.nx,py=t.y+t.ny,pz=t.z+t.nz;
  if(!inB(px,py,pz))return;
  const cur=getB(px,py,pz);
  if(cur!==AIR&&cur!==WATER)return;
  const id=HOTBAR[selected].id;
  // don't place inside player
  const p=player.pos;
  if(px+1>p.x-PR&&px<p.x+PR&&pz+1>p.z-PR&&pz<p.z+PR&&py+1>p.y&&py<p.y+PH&&isOpaque(id))return;
  setB(px,py,pz,id);remeshAround(px,pz);
  sfx(520,0.06,'triangle',0.1);
  dirtySave();
}

/* ============================== Hotbar UI ============================== */
function buildHotbar(){
  const hb=$('#hotbar');hb.innerHTML='';
  HOTBAR.forEach((b,i)=>{
    const d=document.createElement('div');d.className='slot'+(i===selected?' sel':'');
    const img=document.createElement('img');
    const f=FACES[b.id];const tile=f.all!==undefined?f.all:(f.side??0);
    img.src=iconURLs[tile]||iconURLs[3];img.alt=b.name;
    const num=document.createElement('span');num.className='num';num.textContent=i+1;
    const nm=document.createElement('span');nm.className='nm';nm.textContent=b.name;
    d.append(img,num,nm);
    d.onclick=()=>select(i);
    hb.append(d);
  });
}
function select(i){selected=i;buildHotbar();sfx(700,0.04,'sine',0.06)}

/* ============================== Save ============================== */
let saveT=null;
function dirtySave(){clearTimeout(saveT);saveT=setTimeout(save,800)}
function save(){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify({seed:seedStr,px:+player.pos.x.toFixed(2),py:+player.pos.y.toFixed(2),pz:+player.pos.z.toFixed(2),full:b64World()}));
    toast('World saved');
  }catch{try{localStorage.setItem(SAVE_KEY,JSON.stringify({seed:seedStr}))}catch{}}
}
function b64World(){
  let s='';const CH=8192;
  for(let i=0;i<world.length;i+=CH)s+=String.fromCharCode(...world.subarray(i,i+CH));
  return btoa(s);
}
function tryLoad(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
    const d=JSON.parse(raw);if(!d||!d.full||!d.seed)return d;
    const bin=atob(d.full);if(bin.length!==world.length)return d;
    for(let i=0;i<bin.length;i++)world[i]=bin.charCodeAt(i);
    return d;
  }catch{return null}
}

/* ============================== UI wiring ============================== */
const isTouch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
let startedOnce=false;
function showMenu(){$('#menu').classList.remove('hidden');$('#pause').classList.add('hidden');$('#hud').classList.add('hidden');state='menu';document.exitPointerLock?.()}
function showPause(){if(state!=='playing')return;state='paused';$('#pause').classList.remove('hidden')}
function startPlay(){
  startedOnce=true;
  $('#menu').classList.add('hidden');$('#pause').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if(isTouch)$('#touch').classList.remove('hidden');
  state='playing';
  if(!isTouch){try{canvas.requestPointerLock?.()}catch{}}
  toast('WASD move · LMB mine · RMB build');
  sfx(880,0.1,'sine',0.08);
}
$('#btn-play').onclick=()=>{AC?.resume?.();startPlay()};
$('#btn-resume').onclick=()=>{$('#pause').classList.add('hidden');state='playing';if(!isTouch){try{canvas.requestPointerLock?.()}catch{}}};
$('#btn-menu').onclick=()=>{showMenu()};
$('#btn-save').onclick=()=>save();
$('#btn-help').onclick=()=>$('#help').classList.toggle('hidden');
$('#btn-new').onclick=async()=>{
  const s=($('#seed').value||'').trim()||('world-'+((Math.random()*1e6)|0));
  $('#seed').value=s;
  await newWorld(s);startPlay();
};
addEventListener('keydown',e=>{if(e.code==='Escape'&&state==='paused'){$('#pause').classList.add('hidden');state='playing'}});

/* touch controls */
{
  const stick=$('#stick'),knob=$('#knob');
  let sid=null,sx=0,sy=0,mx=0,mz=0;
  stick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];sid=t.identifier;sx=t.clientX;sy=t.clientY;e.preventDefault()},{passive:false});
  addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===sid){
        const dx=t.clientX-sx,dy=t.clientY-sy;
        const len=Math.hypot(dx,dy)||1,cl=Math.min(len,44);
        knob.style.transform=`translate(calc(-50% + ${dx/len*cl}px),calc(-50% + ${dy/len*cl}px))`;
        mx=dx/len*(cl/44);mz=dy/len*(cl/44);
      }else if(state==='playing'&&t.clientX>innerWidth*0.4){
        // look drag
        const l=t._lx??t.clientX,m=t._ly??t.clientY;
        player.yaw-=(t.clientX-l)*0.006;player.pitch-=(t.clientY-m)*0.006;
        player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch));
        t._lx=t.clientX;t._ly=t.clientY;
      }
    }
    if(state==='playing')e.preventDefault();
  },{passive:false});
  addEventListener('touchend',e=>{
    for(const t of e.changedTouches)if(t.identifier===sid){sid=null;mx=0;mz=0;knob.style.transform='translate(-50%,-50%)'}
  });
  window.__stick=()=>({mx,mz});
  // look via canvas drag
  let lid=null,lx=0,ly=0;
  canvas.addEventListener('touchstart',e=>{
    for(const t of e.changedTouches)if(t.clientX>innerWidth*0.35&&lid===null){lid=t.identifier;lx=t.clientX;ly=t.clientY}
  },{passive:true});
  canvas.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches)if(t.identifier===lid){
      player.yaw-=(t.clientX-lx)*0.006;player.pitch-=(t.clientY-ly)*0.006;
      player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch));
      lx=t.clientX;ly=t.clientY;
    }
  },{passive:true});
  canvas.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===lid)lid=null},{passive:true});
  document.querySelectorAll('.tbtn').forEach(b=>{
    b.addEventListener('touchstart',e=>{
      e.preventDefault();
      const a=b.dataset.act;
      if(a==='jump')keys.Space=true;
      if(a==='fly'){player.fly=!player.fly;$('#fly-tag').classList.toggle('hidden',!player.fly)}
      if(a==='break')doBreak();
      if(a==='place')doPlace();
    },{passive:false});
    b.addEventListener('touchend',e=>{if(b.dataset.act==='jump')keys.Space=false},{passive:true});
  });
}

/* ============================== Loop ============================== */
const clock=new THREE.Clock();
let frames=0,fpsT=0,orbit=0;
const fwd=new THREE.Vector3();
function tick(){
  requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),0.05);
  const t=clock.elapsedTime;
  clouds.children.forEach((c,i)=>{c.position.x+=dt*(0.4+i%3*0.2);if(c.position.x>DX)c.position.x=-20});

  if(state==='menu'||state==='boot'){
    orbit+=dt*0.12;
    const cx=0,cz=0;
    camera.position.set(Math.cos(orbit)*52,30,Math.sin(orbit)*52);
    camera.lookAt(cx,12,cz);
  }else{
    // movement — forward = (-sinYaw, -cosYaw), right = (cosYaw, -sinYaw)
    const sp=window.__stick?window.__stick():{mx:0,mz:0};
    const fIn=((keys.KeyW?1:0)-(keys.KeyS?1:0))-sp.mz;
    const sIn=((keys.KeyD?1:0)-(keys.KeyA?1:0))+sp.mx;
    const sprint=(keys.ShiftLeft||keys.ShiftRight)?1.55:1;
    const wInWater=inWater();
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
    if(player.fly){
      const sp2=9;
      const sy=((keys.Space?1:0)||(keys.KeyE?1:0))-((keys.ShiftLeft||keys.ShiftRight)?1:0);
      const fx=-sin, fz=-cos, rx=cos, rz=-sin;
      const wl=Math.hypot(fIn,sIn);
      const fN=wl>0?fIn/wl:0, sN=wl>0?sIn/wl:0;
      const spd=wl>0?sp2:0;
      player.pos.x+=(fx*fN+rx*sN)*spd*dt;
      player.pos.z+=(fz*fN+rz*sN)*spd*dt;
      player.pos.y+=sy*sp2*dt;
      player.pos.x=Math.max(1,Math.min(DX-1,player.pos.x));
      player.pos.z=Math.max(1,Math.min(DZ-1,player.pos.z));
      player.pos.y=Math.max(2,Math.min(DY+10,player.pos.y));
    }else{
      const speed=(wInWater?3.2:4.6)*sprint;
      const fx=-sin, fz=-cos, rx=cos, rz=-sin;
      const wl=Math.hypot(fIn,sIn);
      if(wl>0){player.vel.x=(fx*fIn/wl+rx*sIn/wl)*speed;player.vel.z=(fz*fIn/wl+rz*sIn/wl)*speed}
      else{player.vel.x=0;player.vel.z=0}
      player.vel.y-=25*dt;
      if(wInWater)player.vel.y=Math.max(player.vel.y,-4);
      if(keys.Space){
        if(player.onGround){player.vel.y=8.4;player.onGround=false;sfx(300,0.07,'sine',0.05)}
        else if(wInWater)player.vel.y=Math.min(player.vel.y+30*dt,4);
      }
      // integrate axis-separated
      const p=player.pos;
      p.x+=player.vel.x*dt;
      if(collides(p.x,p.y,p.z)){p.x-=player.vel.x*dt;player.vel.x=0}
      p.z+=player.vel.z*dt;
      if(collides(p.x,p.y,p.z)){p.z-=player.vel.z*dt;player.vel.z=0}
      p.y+=player.vel.y*dt;
      player.onGround=false;
      if(collides(p.x,p.y,p.z)){
        if(player.vel.y<=0){
          p.y=Math.floor(p.y+0.5)+0.02;
          let guard=0;while(collides(p.x,p.y,p.z)&&guard++<40)p.y+=0.05;
          // snap down if still floating slightly
          player.onGround=true;
        }else{
          p.y-=player.vel.y*dt;
        }
        player.vel.y=0;
      }
      // void guard
      if(p.y<-8){spawn();toast('You fell into the void')}
      player.pos.x=Math.max(0.5,Math.min(DX-0.5,player.pos.x));
      player.pos.z=Math.max(0.5,Math.min(DZ-0.5,player.pos.z));
    }
    camera.position.set(player.pos.x+worldOffset.x,player.pos.y+EYE,player.pos.z+worldOffset.z);
    camera.rotation.set(0,0,0);
    camera.rotation.order='YXZ';
    camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;

    // highlight
    const tgt=raycast();lastTarget=tgt;
    if(tgt){hl.visible=true;hl.position.set(tgt.x+0.5+worldOffset.x,tgt.y+0.5,tgt.z+0.5+worldOffset.z)}
    else hl.visible=false;

    // coords
    frames%10===0&&($('#coords').textContent=`${player.pos.x.toFixed(0)}, ${player.pos.y.toFixed(0)}, ${player.pos.z.toFixed(0)}`);
  }

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.userData.life-=dt;
    p.userData.v.y-=12*dt;
    p.position.x+=p.userData.v.x*dt+worldOffset.x*0; // particles in offset space
    p.position.y+=p.userData.v.y*dt;
    p.position.z+=p.userData.v.z*dt;
    p.rotation.x+=dt*5;p.rotation.y+=dt*4;
    if(p.userData.life<=0){scene.remove(p);particles.splice(i,1)}
  }

  renderer.render(scene,camera);
  frames++;fpsT+=dt;
  if(fpsT>=0.5){$('#fps').textContent=Math.round(frames/fpsT)+' fps';frames=0;fpsT=0}
}
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

/* ============================== Boot ============================== */
async function newWorld(seed){
  setLoad(0.02,'Generating terrain…');
  await generate(seed,async p=>{setLoad(p,`Generating terrain… ${(p*100)|0}%`);await new Promise(r=>setTimeout(r,0))});
  setLoad(0.9,'Meshing chunks…');
  await new Promise(r=>setTimeout(r,0));
  remeshAll();
  spawn();
  setLoad(1,'Ready');
}
(async function boot(){
  buildHotbar();select(0);
  const seedInput=$('#seed');
  let initialSeed=('world-'+((Math.random()*90000+10000)|0));
  let restored=null;
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw){const d=JSON.parse(raw);if(d&&(d.full||d.seed)){restored=d;if(d.seed)initialSeed=d.seed}}
  }catch{}
  seedInput.placeholder=initialSeed;
  if(restored&&restored.full){
    try{
      seedStr=restored.seed||initialSeed;
      const bin=atob(restored.full);
      if(bin.length===world.length){
        for(let i=0;i<bin.length;i++)world[i]=bin.charCodeAt(i);
        setLoad(0.5,'Loading saved world…');
        remeshAll();
        if(restored.px!==undefined)player.pos.set(restored.px,restored.py,restored.pz);
        else spawn();
        setLoad(1,'Ready');
        $('#loading').classList.add('hidden');
        showMenu();
        tick();
        return;
      }
    }catch{}
  }
  await newWorld(seedInput.value.trim()||initialSeed);
  $('#loading').classList.add('hidden');
  showMenu();
  tick();
})();
