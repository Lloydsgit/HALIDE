/* ============================================================
   HALIDE — app.js
   Personal photo lab. Presets come from presets.js, procedural
   effects from effects.js. Everything renders client-side.
   ============================================================ */

/* ---------------------------------------------------------------
   Tone-map defaults (used by Auto and by the develop sliders)
   --------------------------------------------------------------- */
const TONES = {
  default:    { exposure:0, contrast:0, saturation:0, temperature:0, tint:0, fade:0 },
  cinematic:  { exposure:-4, contrast:22, saturation:-12, temperature:6, tint:-6, fade:6 },
  vivid:      { exposure:4, contrast:16, saturation:26, temperature:2, tint:0, fade:0 },
  matte:      { exposure:2, contrast:-14, saturation:-6, temperature:0, tint:0, fade:20 },
  bright:     { exposure:14, contrast:6, saturation:8, temperature:2, tint:0, fade:0 },
};
const DEFAULT_TONE = { ...TONES.default };

const LIB = window.HALIDE_LIB;
if (!LIB) console.error('HALIDE: presets.js did not load');

/* ---------------------------------------------------------------
   Textures — one-tap analog grit, layered on top of any preset
   --------------------------------------------------------------- */
const TEXTURES = [
  { id:'none',     label:'Clean',    effect:null },
  { id:'grain',    label:'Grain',    effect:['grain', { amount:.4 }] },
  { id:'paper',    label:'Paper',    effect:['papergrain', { amount:.45 }] },
  { id:'dust',     label:'Dust',     effect:['dust', { count:90 }] },
  { id:'scratch',  label:'Scratch',  effect:['scratch', { count:6 }] },
  { id:'crumple',  label:'Crumple',  effect:['crumple', { amount:.5 }] },
  { id:'halftone', label:'Halftone', effect:['halftone', { size:6 }] },
  { id:'scanline', label:'Scanline', effect:['scanlines', { amount:.35 }] },
  { id:'glitch',   label:'Glitch',   effect:['glitch', { amount:.45 }] },
  { id:'bokeh',    label:'Bokeh',    effect:['bokeh', { count:12 }] },
  { id:'sparkle',  label:'Sparkle',  effect:['sparkle', { count:34 }] },
  { id:'leak',     label:'Light Leak', effect:['lightleak', { corner:'tl', amount:.55 }] },
  { id:'vignette', label:'Vignette', effect:['vignette', { amount:.7 }] },
  { id:'holo',     label:'Holo',     effect:['holographic', { amount:.5 }] },
];

/* ---------------------------------------------------------------
   State
   --------------------------------------------------------------- */
const state = {
  collection: 'film',
  preset: null,
  intensity: 100,
  texture: null,
  compare: false,
  fxOff: false,
  image: null,
  imageName: '',
  tone: { ...DEFAULT_TONE },
  optics: {
    vignette: 0, grain: 0, bloom: 0, halation: 0,
    haloTint: 'rgba(255,150,90,.45)',
    chromatic: 0, scanlines: 0, sharpen: 0, temp: 0, fade: 0,
    flash: false, stamp: false, scanToggle: false, digitize: false,
  },
  card: { type:'polaroid', title:'', caption:'', accent:'#ff7a29' },
  format: { aspect:'auto', fit:'cover' },
  size: 'card',
  fmt: 'png',
  quality: .95,
  search: '',
  favorites: [],
  recent: [],
  sampleImg: null,
  layers: [],
  selectedLayer: null,
  overlayCat: null,
  overlaySearch: '',
};

const OL = window.HALIDE_OVERLAYS;
const FONTS = window.HALIDE_FONTS;

const RENDER_LONG = 1200;
const ASPECTS = [
  { id:'auto', label:'Auto',  r:null },
  { id:'1:1',  label:'1:1',   r:1 },
  { id:'4:5',  label:'4:5',   r:4/5 },
  { id:'3:4',  label:'3:4',   r:3/4 },
  { id:'2:3',  label:'2:3',   r:2/3 },
  { id:'9:16', label:'9:16',  r:9/16 },
  { id:'3:2',  label:'3:2',   r:3/2 },
  { id:'4:3',  label:'4:3',   r:4/3 },
  { id:'16:9', label:'16:9',  r:16/9 },
  { id:'21:9', label:'21:9',  r:21/9 },
  { id:'3:1',  label:'Pano 3:1', r:3 },
];
const CARD_TYPES = [
  { id:'none',      label:'None' },
  { id:'polaroid',  label:'Polaroid' },
  { id:'print',     label:'Photo Print' },
  { id:'film',      label:'Film Strip' },
  { id:'digicam',   label:'Digicam LCD' },
  { id:'pano',      label:'Pano Card' },
  { id:'filmstrip', label:'Contact Sheet' },
  { id:'museum',    label:'Gallery Mount' },
];
const SIZES = [
  { id:'card', label:'1024', long:1024 },
  { id:'poster', label:'2048', long:2048 },
  { id:'max', label:'3200', long:3200 },
];

/* ---------------------------------------------------------------
   DOM
   --------------------------------------------------------------- */
const $ = (s) => document.querySelector(s);
const canvas = $('#out');
const ctx = canvas.getContext('2d', { alpha:false });
const stage = $('#stage');
const canvasWrap = $('#canvasWrap');
const emptyState = $('#emptyState');
const stageFoot = $('#stageFoot');
const presetGrid = $('#presetGrid');
const gridLabel = $('#gridLabel');
const slidersEl = $('#sliders');
const opticSlidersEl = $('#opticSliders');
const cardPills = $('#cardPills');
const aspectPills = $('#aspectPills');
const fitPills = $('#fitPills');
const sizePills = $('#sizePills');
const fmtPills = $('#fmtPills');
const texturePills = $('#texturePills');
const collNav = $('#collNav');
const fileInput = $('#fileInput');
const toastEl = $('#toast');
const layerList = $('#layerList');
const textEditor = $('#textEditor');
const overlayEditor = $('#overlayEditor');
const overlayGrid = $('#overlayGrid');
const overlayNav = $('#overlayNav');
const fontGrid = $('#fontGrid');
const fontNav = $('#fontNav');
const fontModal = $('#fontModal');

const SCRATCH = document.createElement('canvas');
const SCTX = SCRATCH.getContext('2d', { willReadFrequently:true });
let offscreen = null;

/* ---------------------------------------------------------------
   Utils
   --------------------------------------------------------------- */
let toastTimer = null;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));

function slug(s){
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function roundRect(c, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  c.beginPath();
  c.moveTo(x+rr, y);
  c.arcTo(x+w, y, x+w, y+h, rr);
  c.arcTo(x+w, y+h, x, y+h, rr);
  c.arcTo(x, y+h, x, y, rr);
  c.arcTo(x, y, x+w, y, rr);
  c.closePath();
}

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------
   Preset helpers
   --------------------------------------------------------------- */
function presetById(id){ return LIB ? LIB.get(id) : null; }
function activePreset(){ return state.preset; }

/* Which procedural effects does a preset already bake in? Used so the
   optics pass does not double up on bloom / grain / vignette. */
function presetFxNames(p){
  const out = {};
  if (p && p.fx) p.fx.forEach(f => { out[Array.isArray(f) ? f[0] : f] = true; });
  return out;
}

function applyPresetObject(p, keepTone){
  if (!p) return;
  state.preset = p;
  const fx = presetFxNames(p);
  if (!keepTone) state.tone = { ...DEFAULT_TONE };
  state.optics = {
    ...state.optics,
    vignette:  fx.vignette  ? 0 : Math.round((p.vig   || 0) * 100),
    grain:     fx.grain || fx.papergrain ? 0 : Math.round((p.grain || 0) * 100),
    bloom:     fx.bloom     ? 0 : Math.round((p.bloom || 0) * 100),
    halation:  fx.bloom     ? 0 : Math.round((p.halo  || 0) * 100),
    haloTint:  p.haloTint || 'rgba(255,150,90,.45)',
    temp:      p.temp || 0,
    fade:      p.fade || 0,
    chromatic: 0, scanlines: 0, sharpen: 0,
    flash: false, stamp: state.optics.stamp, scanToggle: false, digitize: false,
  };
}
function computeLayout(ar, cardType){
  const L = 1000;
  let W, H, img = { x:0, y:0, w:0, h:0 }, radius = 0;
  let chrome = { t:0, r:0, b:0, l:0 };
  let winRadius = 0;

  if (ar >= 1){ W = L; H = Math.round(L / ar); }
  else { H = L; W = Math.round(L * ar); }

  const base = { W, H, img:{...img}, radius, chrome, winRadius, cardType, ar };

  switch (cardType){
    case 'polaroid': {
      const pad = Math.round(W * .055), bot = Math.round(W * .19);
      const iw = W - pad*2, ih = Math.min(H - pad - bot, Math.round(iw * .86));
      const fh = pad + ih + bot;
      base.W = W; base.H = fh;
      base.img = { x: pad, y: pad, w: iw, h: ih };
      base.radius = Math.round(W * .012);
      base.winRadius = Math.round(W * .004);
      base.chrome = { t:pad, r:pad, b:bot, l:pad };
      break;
    }
    case 'print': {
      const pad = Math.round(W * .042);
      base.W = W; base.H = H + pad*2;
      base.img = { x: pad, y: pad, w: W - pad*2, h: H };
      base.radius = 2;
      base.winRadius = 2;
      base.chrome = { t:pad, r:pad, b:pad, l:pad };
      break;
    }
    case 'film': {
      const rail = Math.round(W * .11);
      base.W = W; base.H = H;
      base.img = { x: rail, y: 0, w: W - rail*2, h: H };
      base.chrome = { t:0, r:rail, b:0, l:rail };
      base.radius = 0;
      base.winRadius = 0;
      break;
    }
    case 'digicam': {
      const pad = Math.round(W * .055);
      base.W = W; base.H = H + pad*2;
      base.img = { x: pad, y: pad, w: W - pad*2, h: H };
      base.radius = Math.round(W * .045);
      base.winRadius = Math.round(W * .03);
      base.chrome = { t:pad, r:pad, b:pad, l:pad };
      break;
    }
    case 'pano': {
      const pad = Math.round(W * .03);
      base.W = W; base.H = H + pad*2;
      base.img = { x: pad, y: pad, w: W - pad*2, h: H };
      base.radius = Math.round(W * .05);
      base.winRadius = Math.round(W * .028);
      base.chrome = { t:pad, r:pad, b:pad, l:pad };
      break;
    }
    case 'filmstrip': {
      const gx = Math.round(W * .018), gy = Math.round(W * .022);
      const pad = Math.round(W * .035);
      base.W = W; base.H = H + pad*2;
      base.img = { x: pad, y: pad, w: W - pad*2, h: H };
      base.grid = { x:gx, y:gy };
      base.radius = 3;
      base.winRadius = 2;
      base.chrome = { t:pad, r:pad, b:pad, l:pad };
      break;
    }
    case 'museum': {
      const pad = Math.round(W * .115), bot = Math.round(W * .155);
      base.W = W + pad*2; base.H = H + pad + bot;
      base.img = { x: pad, y: pad, w: W, h: H };
      base.radius = 3;
      base.winRadius = 2;
      base.chrome = { t:pad, r:pad, b:bot, l:pad };
      break;
    }
    default: { // none
      base.W = W; base.H = H;
      base.img = { x:0, y:0, w:W, h:H };
      base.radius = 0;
      base.winRadius = 0;
      base.chrome = { t:0, r:0, b:0, l:0 };
    }
  }
  return base;
}

/* ---------------------------------------------------------------
   The developed photo — filter, tone, preset effects, texture
   --------------------------------------------------------------- */

/* Build a full-frame canvas (base.W x base.H) with the photo drawn into
   base.img. style=false gives the untouched photo, for compare mode. */
function buildFrame(base, style){
  const im = base.img;
  const o = document.createElement('canvas');
  o.width = base.W; o.height = base.H;
  const x = o.getContext('2d');
  const img = state.image;
  const cover = state.format.fit === 'cover';
  const sc = cover
    ? Math.max(im.w/img.naturalWidth, im.h/img.naturalHeight)
    : Math.min(im.w/img.naturalWidth, im.h/img.naturalHeight);
  const dw = img.naturalWidth*sc, dh = img.naturalHeight*sc;
  const dx = im.x + (im.w-dw)/2, dy = im.y + (im.h-dh)/2;

  if (!cover){
    const bg = x.createLinearGradient(im.x, im.y, im.x+im.w, im.y+im.h);
    bg.addColorStop(0,'#17171a'); bg.addColorStop(1,'#0c0c0e');
    x.fillStyle = bg; x.fillRect(im.x, im.y, im.w, im.h);
  }

  const p = style ? state.preset : null;
  if (p && p.f && p.f !== 'none') x.filter = p.f;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, dx, dy, dw, dh);
  x.filter = 'none';

  if (!style) return o;

  applyToneCurve(o, im);

  if (p && p.fx && !state.fxOff && window.applyEffects){
    const fx = window.applyEffects(o, p.fx);
    if (fx && fx !== o){ x.clearRect(0,0,o.width,o.height); x.drawImage(fx, 0, 0); }
  }

  // signature tint layers: highlight screen, midtone overlay, shadow multiply
  if (p && (p.h || p.t || p.l)){
    x.save();
    x.beginPath();
    if (base.winRadius) roundRect(x, im.x, im.y, im.w, im.h, base.winRadius);
    else x.rect(im.x, im.y, im.w, im.h);
    x.clip();
    if (p.h){ x.globalCompositeOperation='screen';   x.fillStyle=p.h; x.fillRect(im.x,im.y,im.w,im.h); }
    if (p.t){ x.globalCompositeOperation='overlay';  x.fillStyle=p.t; x.fillRect(im.x,im.y,im.w,im.h); }
    if (p.l){ x.globalCompositeOperation='multiply'; x.fillStyle=p.l; x.fillRect(im.x,im.y,im.w,im.h); }
    x.restore();
  }

  const tex = TEXTURES.find(t => t.id === state.texture);
  if (tex && tex.effect && window.applyEffects){
    const t = window.applyEffects(o, [tex.effect]);
    if (t && t !== o){ x.clearRect(0,0,o.width,o.height); x.drawImage(t, 0, 0); }
  }
  return o;
}

/* per-pixel develop pass, limited to the photo window */
function applyToneCurve(cv, im){
  const t = state.tone, op = state.optics;
  const exposure = t.exposure / 100;
  const contrast = t.contrast / 100;
  const sat = t.saturation / 100;
  const temp = (t.temperature/100) + (op.temp || 0);
  const tint = t.tint / 100;
  const fade = clamp((t.fade/100) + (op.fade || 0));
  if (!(exposure || contrast || sat || temp || tint || fade)) return;

  const w = im.w, h = im.h;
  const max = 900000;
  const sx = Math.min(1, Math.sqrt(max/(w*h)));
  const cw = Math.max(1, Math.round(w*sx)), ch = Math.max(1, Math.round(h*sx));

  SCRATCH.width = cw; SCRATCH.height = ch;
  SCTX.setTransform(1,0,0,1,0,0);
  SCTX.clearRect(0,0,cw,ch);
  SCTX.drawImage(cv, im.x, im.y, w, h, 0, 0, cw, ch);

  let data;
  try { data = SCTX.getImageData(0,0,cw,ch); }
  catch(e){ return; }
  const px = data.data;
  const c = 1 + contrast;
  const satK = 1 + sat;
  const exK = Math.pow(2, exposure*1.1);

  for (let i=0; i<px.length; i+=4){
    if (px[i+3] < 8) continue;
    let r = px[i], g = px[i+1], b = px[i+2];
    r *= exK; g *= exK; b *= exK;
    r += temp*46; b -= temp*46;
    g += tint*34; r += tint*16; b += tint*16;
    r = (r-128)*c + 128; g = (g-128)*c + 128; b = (b-128)*c + 128;
    const l = .2126*r + .7152*g + .0722*b;
    r = l + (r-l)*satK; g = l + (g-l)*satK; b = l + (b-l)*satK;
    if (fade){
      const lift = fade*62;
      r = r*(1-fade*.5) + lift; g = g*(1-fade*.5) + lift; b = b*(1-fade*.5) + lift;
    }
    px[i]   = r<0?0:r>255?255:r;
    px[i+1] = g<0?0:g>255?255:g;
    px[i+2] = b<0?0:b>255?255:b;
  }

  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').putImageData(data, 0, 0);
  const tc = cv.getContext('2d');
  tc.setTransform(1,0,0,1,0,0);
  tc.save();
  tc.beginPath();
  roundRect(tc, im.x, im.y, w, h, 0);
  tc.clip();
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(tmp, 0, 0, cw, ch, im.x, im.y, w, h);
  tc.restore();
}

/* ---------------------------------------------------------------
   Optics — bloom, halation, chromatic aberration, scanlines, flash
   --------------------------------------------------------------- */
function makeBlur(src, w, h, px){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.filter = `blur(${Math.max(1,px)}px)`;
  x.drawImage(src, 0, 0);
  return c;
}

function tintedBlur(src, w, h, px, tint, alpha){
  const c = makeBlur(src, w, h, px);
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = tint;
  x.fillRect(0,0,w,h);
  return { canvas:c, alpha };
}

function applyOptics(d, base, s, frame){
  const o = state.optics;
  const { x, y, w, h } = base.img;
  const long = Math.max(base.W, base.H);
  if (!frame) return;

  // everything below stays inside the photo window
  d.save();
  d.beginPath();
  if (base.winRadius) roundRect(d, x, y, w, h, base.winRadius);
  else d.rect(x, y, w, h);
  d.clip();

  // --- chromatic aberration: shifted R / B copies blended over ---
  if (o.chromatic > 0){
    const shift = (o.chromatic/100) * long * .006;
    d.globalCompositeOperation = 'screen';
    d.globalAlpha = .5;
    d.drawImage(channelOf(frame, 'r', shift), 0, 0);
    d.drawImage(channelOf(frame, 'b', -shift), 0, 0);
  }

  // --- bloom (bright light bleed) ---
  if (o.bloom > 0){
    const bl = makeBlur(frame, base.W, base.H, long * .012);
    d.globalCompositeOperation = 'screen';
    d.globalAlpha = clamp(o.bloom/100) * .85;
    d.drawImage(bl, 0, 0);
  }

  // --- halation (warm glow) ---
  if (o.halation > 0){
    const t = tintedBlur(frame, base.W, base.H, long * .02, o.haloTint || 'rgba(255,140,80,.5)', 1);
    d.globalCompositeOperation = 'screen';
    d.globalAlpha = clamp(o.halation/100) * .7;
    d.drawImage(t.canvas, 0, 0);
  }
  d.globalCompositeOperation = 'source-over';
  d.globalAlpha = 1;
  d.restore();

  // --- flash: radial white blowout centred high ---
  if (o.flash){
    const g = d.createRadialGradient(
      x + w*.5, y + h*.36, long*.02,
      x + w*.5, y + h*.5, long*.72
    );
    g.addColorStop(0,'rgba(255,255,255,.34)');
    g.addColorStop(.45,'rgba(255,255,255,.12)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    d.save();
    d.beginPath();
    roundRect(d, x, y, w, h, base.winRadius||0);
    d.clip();
    d.fillStyle = g;
    d.fillRect(x,y,w,h);
    d.globalCompositeOperation = 'screen';
    d.globalAlpha = .6;
    d.fillStyle = g;
    d.fillRect(x,y,w,h);
    d.restore();
  }

  // --- scanlines (LCD / CCD texture) ---
  if (o.scanlines > 0){
    d.save();
    d.beginPath();
    roundRect(d, x, y, w, h, base.winRadius||0);
    d.clip();
    d.globalAlpha = clamp(o.scanlines/100) * .5;
    d.fillStyle = '#000';
    const step = Math.max(2, Math.round(long/300));
    for (let yy=y; yy<y+h; yy+=step*2){
      d.fillRect(x, yy, w, step);
    }
    d.globalAlpha = clamp(o.scanlines/100) * .12;
    d.fillStyle = '#8fd8ff';
    for (let xx=x; xx<x+w; xx+=step*2){
      d.fillRect(xx, y, step, h);
    }
    d.restore();
  }

  // --- vignette ---
  if (o.vignette > 0){
    const g = d.createRadialGradient(
      x + w/2, y + h/2, Math.min(w,h)*.2,
      x + w/2, y + h/2, Math.max(w,h)*.78
    );
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(.55,`rgba(0,0,0,${clamp(o.vignette/100)*.18})`);
    g.addColorStop(1,`rgba(0,0,0,${clamp(o.vignette/100)*.9})`);
    d.save();
    d.beginPath();
    roundRect(d, x, y, w, h, base.winRadius||0);
    d.clip();
    d.fillStyle = g;
    d.fillRect(x,y,w,h);
    d.restore();
  }

  // --- grain ---
  if (o.grain > 0){
    d.save();
    d.beginPath();
    roundRect(d, x, y, w, h, base.winRadius||0);
    d.clip();
    d.globalCompositeOperation = 'overlay';
    d.globalAlpha = clamp(o.grain/100) * .55;
    d.drawImage(grainTile(long, o.grain), x, y, w, h);
    d.restore();
  }
}

let grainCache = {};
function grainTile(long, amount){
  const size = 256;
  const key = size;
  if (!grainCache[key]){
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    const rnd = mulberry32(20240607);
    for (let i=0;i<img.data.length;i+=4){
      const v = 128 + (rnd()-0.5)*255;
      img.data[i]=img.data[i+1]=img.data[i+2]=v;
      img.data[i+3]=255;
    }
    x.putImageData(img,0,0);
    grainCache[key]=c;
  }
  return grainCache[key];
}

/* split a canvas into a single colour channel with a horizontal offset */
function channelOf(src, ch, shift){
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, shift, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = ch === 'r' ? '#ff0000' : '#0000ff';
  x.fillRect(0,0,c.width,c.height);
  return c;
}

/* ---------------------------------------------------------------
   Card frames — the custom pic-card mounting
   --------------------------------------------------------------- */
function fpx(px){ return px; }
function font(weight, px, family){
  return `${weight?weight+' ':''}${px}px ${family}`;
}

function shade(hex, amt){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
  r = clamp(Math.round(r + amt*255),0,255);
  g = clamp(Math.round(g + amt*255),0,255);
  b = clamp(Math.round(b + amt*255),0,255);
  return `rgb(${r},${g},${b})`;
}

function drawCardFrame(d, base, s){
  switch (base.cardType){
    case 'polaroid': return drawPolaroid(d, base, s);
    case 'print':    return drawPrint(d, base, s);
    case 'film':     return drawFilm(d, base, s);
    case 'digicam':  return drawDigicam(d, base, s);
    case 'pano':     return drawPano(d, base, s);
    case 'filmstrip':return drawFilmstrip(d, base, s);
    case 'museum':   return drawMuseum(d, base, s);
  }
}

function imageInnerShadow(d, img, r){
  d.save();
  d.beginPath(); roundRect(d, img.x, img.y, img.w, img.h, r||0); d.clip();
  const g = d.createLinearGradient(0, img.y, 0, img.y + img.h*.12);
  g.addColorStop(0,'rgba(0,0,0,.35)'); g.addColorStop(1,'rgba(0,0,0,0)');
  d.fillStyle = g; d.fillRect(img.x, img.y, img.w, img.h*.12);
  d.restore();
}

function drawPolaroid(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  // card body
  d.save();
  d.shadowColor = 'rgba(0,0,0,.6)';
  d.shadowBlur = W*.03; d.shadowOffsetY = W*.012;
  const body = d.createLinearGradient(0,0,W,H);
  body.addColorStop(0,'#fbf7ec'); body.addColorStop(.5,'#f4eee1'); body.addColorStop(1,'#e8e0cf');
  d.fillStyle = body;
  roundRect(d, 0, 0, W, H, base.radius);
  d.fill();
  d.restore();

  // subtle paper edge
  d.strokeStyle = 'rgba(0,0,0,.18)'; d.lineWidth = Math.max(1,W*.0015);
  roundRect(d, .5, .5, W-1, H-1, base.radius); d.stroke();

  // image window
  d.save();
  d.shadowColor = 'rgba(0,0,0,.28)'; d.shadowBlur = W*.014;
  d.fillStyle = '#000';
  roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.fill();
  d.restore();
  imageInnerShadow(d, im, base.winRadius);

  // handwritten title + mono caption in the chin
  const cx = W/2;
  const chinY = im.y + im.h;
  const chinH = H - chinY;
  d.textAlign = 'center';
  d.fillStyle = '#2b2621';
  const tpx = W*.085;
  d.font = font(600, tpx, '"Caveat", cursive');
  d.textBaseline = 'middle';
  const title = (state.card.title || '').trim();
  if (title){
    d.fillText(fitText(d, title, W*.84), cx, chinY + chinH*.42);
  }
  const cap = (state.card.caption || '').trim();
  if (cap){
    d.font = font(400, W*.028, '"IBM Plex Mono", monospace');
    d.fillStyle = 'rgba(60,54,46,.72)';
    d.fillText(fitText(d, cap, W*.82), cx, chinY + chinH*(title?0.72:0.5));
  }
  // accent tick
  d.fillStyle = state.card.accent;
  roundRect(d, cx - W*.03, H - chinH*.14, W*.06, Math.max(2,W*.006), 99);
  d.fill();
}

function drawPrint(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  d.save();
  d.shadowColor = 'rgba(0,0,0,.65)';
  d.shadowBlur = W*.03; d.shadowOffsetY = W*.012;
  const g = d.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#fdfbf6'); g.addColorStop(1,'#efe9dd');
  d.fillStyle = g;
  roundRect(d,0,0,W,H,base.radius); d.fill();
  d.restore();

  d.save();
  d.shadowColor='rgba(0,0,0,.3)'; d.shadowBlur=W*.01;
  d.fillStyle='#000';
  roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.fill();
  d.restore();

  const stripY = im.y + im.h;
  const stripH = H - stripY;
  // accent rule
  d.fillStyle = state.card.accent;
  d.fillRect(im.x, stripY + stripH*.22, im.w, Math.max(2, W*.0035));
  d.textAlign = 'left';
  d.textBaseline = 'middle';
  const title = (state.card.title || '').trim();
  d.fillStyle = '#26221d';
  if (title){
    d.font = font(600, W*.038, '"Fraunces", Georgia, serif');
    d.fillText(fitText(d, title, im.w*.62), im.x, stripY + stripH*.6);
  }
  const cap = (state.card.caption || '').trim();
  if (cap){
    d.font = font(400, W*.022, '"IBM Plex Mono", monospace');
    d.fillStyle = 'rgba(60,54,46,.7)';
    d.textAlign = 'right';
    d.fillText(fitText(d, cap, im.w*.5), im.x + im.w, stripY + stripH*.6);
  }
}

function drawFilm(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  const rail = base.chrome.l;
  // body
  d.fillStyle = '#0b0b0c';
  d.fillRect(0,0,W,H);
  // subtle sheen on rails
  const sh = d.createLinearGradient(0,0,W,0);
  sh.addColorStop(0,'rgba(255,255,255,.06)');
  sh.addColorStop(.06,'rgba(255,255,255,0)');
  sh.addColorStop(.94,'rgba(255,255,255,0)');
  sh.addColorStop(1,'rgba(255,255,255,.05)');
  d.fillStyle = sh; d.fillRect(0,0,W,H);

  // image window sits flush; add inner shadow + thin frame
  imageInnerShadow(d, im, 0);
  d.strokeStyle = 'rgba(255,255,255,.08)'; d.lineWidth = Math.max(1,W*.001);
  d.strokeRect(im.x, im.y, im.w, im.h);

  // sprocket holes
  const holeW = rail*.5, holeH = rail*.62, gap = rail*1.12;
  d.fillStyle = '#e9e4d6';
  for (let y = rail*.4; y < H - holeH*.6; y += gap){
    roundRect(d, rail*.25, y, holeW, holeH, holeW*.28); d.fill();
    roundRect(d, W - rail*.25 - holeW, y, holeW, holeH, holeW*.28); d.fill();
  }

  // rail text (vertical) + frame number
  d.save();
  d.translate(rail*.5, H*.5);
  d.rotate(-Math.PI/2);
  d.textAlign = 'center'; d.textBaseline = 'middle';
  d.fillStyle = 'rgba(255,255,255,.34)';
  d.font = font(500, rail*.3, '"IBM Plex Mono", monospace');
  d.fillText('HALIDE 400', 0, 0);
  d.restore();

  const cap = (state.card.caption || state.card.title || '').trim();
  d.save();
  d.translate(W - rail*.5, H*.5);
  d.rotate(Math.PI/2);
  d.textAlign = 'center'; d.textBaseline = 'middle';
  d.fillStyle = state.card.accent;
  d.font = font(500, rail*.3, '"IBM Plex Mono", monospace');
  d.fillText(fitText(d, cap || '◦ 12A', H*.8), 0, 0);
  d.restore();
}

function drawDigicam(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  const r = base.radius;
  // plastic body
  d.save();
  d.shadowColor='rgba(0,0,0,.7)'; d.shadowBlur=W*.03; d.shadowOffsetY=W*.012;
  const body = d.createLinearGradient(0,0,W,H);
  body.addColorStop(0,'#3a3a40'); body.addColorStop(.35,'#232327'); body.addColorStop(1,'#17171a');
  d.fillStyle = body;
  roundRect(d,0,0,W,H,r); d.fill();
  d.restore();
  // top gloss
  d.save();
  roundRect(d,0,0,W,H,r); d.clip();
  const gl = d.createLinearGradient(0,0,0,H*.5);
  gl.addColorStop(0,'rgba(255,255,255,.16)'); gl.addColorStop(1,'rgba(255,255,255,0)');
  d.fillStyle=gl; d.fillRect(0,0,W,H*.5);
  d.restore();

  // LCD bezel
  d.fillStyle = '#08080a';
  roundRect(d, im.x - W*.012, im.y - W*.012, im.w + W*.024, im.h + W*.024, base.winRadius + W*.012);
  d.fill();
  // accent LED
  d.save();
  d.shadowColor = state.card.accent; d.shadowBlur = W*.02;
  d.fillStyle = state.card.accent;
  d.beginPath(); d.arc(im.x + im.w*.02, im.y + im.h*.035, W*.012, 0, Math.PI*2); d.fill();
  d.restore();
  imageInnerShadow(d, im, base.winRadius);

  // glass reflection over LCD
  d.save();
  d.beginPath(); roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.clip();
  const rf = d.createLinearGradient(im.x, im.y, im.x + im.w*.7, im.y + im.h*.8);
  rf.addColorStop(0,'rgba(255,255,255,.13)');
  rf.addColorStop(.45,'rgba(255,255,255,.02)');
  rf.addColorStop(1,'rgba(255,255,255,0)');
  d.fillStyle = rf; d.fillRect(im.x, im.y, im.w, im.h);
  d.restore();

  // bottom status bar
  const barY = im.y + im.h;
  const barH = H - barY - im.y;
  const cy = barY + barH*.55;
  d.textBaseline = 'middle';
  d.textAlign = 'left';
  d.font = font(500, W*.026, '"IBM Plex Mono", monospace');
  d.fillStyle = state.card.accent;
  d.fillText('● REC', im.x, cy);
  d.fillStyle = 'rgba(240,240,235,.82)';
  const title = (state.card.title || 'DSC-0042').trim();
  d.textAlign = 'center';
  d.fillText(fitText(d, title, im.w*.5), im.x + im.w/2, cy);
  // date + battery
  d.textAlign = 'right';
  d.font = font(400, W*.024, '"IBM Plex Mono", monospace');
  d.fillStyle = 'rgba(230,230,225,.7)';
  const cap = (state.card.caption || '2004.08.14  15:32').trim();
  d.fillText(fitText(d, cap, im.w*.44), im.x + im.w, cy);
}

function drawPano(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  const r = base.radius;
  // dark device shell
  d.save();
  d.shadowColor='rgba(0,0,0,.72)'; d.shadowBlur=W*.03; d.shadowOffsetY=W*.01;
  const body = d.createLinearGradient(0,0,0,H);
  body.addColorStop(0,'#22262b'); body.addColorStop(.5,'#14171a'); body.addColorStop(1,'#0d0f11');
  d.fillStyle = body;
  roundRect(d,0,0,W,H,r); d.fill();
  d.restore();

  // screen bezel
  d.fillStyle = '#050506';
  roundRect(d, im.x - W*.008, im.y - W*.008, im.w + W*.016, im.h + W*.016, base.winRadius + W*.008);
  d.fill();
  imageInnerShadow(d, im, base.winRadius);

  // glass sheen
  d.save();
  d.beginPath(); roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.clip();
  const sheen = d.createLinearGradient(im.x, im.y + im.h*.4, im.x + im.w, im.y + im.h*.6);
  sheen.addColorStop(0,'rgba(255,255,255,0)');
  sheen.addColorStop(.5,'rgba(255,255,255,.07)');
  sheen.addColorStop(1,'rgba(255,255,255,0)');
  d.fillStyle = sheen; d.fillRect(im.x, im.y, im.w, im.h);
  d.restore();

  // accent arc + label
  const barY = im.y + im.h;
  const barH = H - barY - im.y;
  const cy = barY + barH*.55;
  d.textBaseline='middle';
  d.textAlign='left';
  d.font = font(600, W*.024, '"IBM Plex Mono", monospace');
  d.fillStyle = state.card.accent;
  d.fillText('◐ PANO', im.x, cy);
  const title = (state.card.title || '').trim();
  if (title){
    d.fillStyle = 'rgba(240,242,240,.9)';
    d.font = font(400, W*.024, '"IBM Plex Mono", monospace');
    d.textAlign='center';
    d.fillText(fitText(d, title, im.w*.5), im.x + im.w/2, cy);
  }
  const cap = (state.card.caption || '').trim();
  d.textAlign='right';
  d.font = font(400, W*.022, '"IBM Plex Mono", monospace');
  d.fillStyle = 'rgba(220,226,224,.6)';
  d.fillText(fitText(d, cap || '360°', im.w*.4), im.x + im.w, cy);
}

function drawFilmstrip(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  // dark sheet
  d.fillStyle = '#111112'; d.fillRect(0,0,W,H);
  d.save();
  d.shadowColor='rgba(0,0,0,.6)'; d.shadowBlur=W*.02;
  d.fillStyle='#000'; roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.fill();
  d.restore();
  imageInnerShadow(d, im, base.winRadius);

  // contact grid overlay
  const cols = 3, rows = 2;
  d.strokeStyle = 'rgba(10,10,10,.75)';
  d.lineWidth = Math.max(2, W*.006);
  for (let i=1;i<cols;i++){ const x = im.x + im.w*i/cols; d.beginPath(); d.moveTo(x, im.y); d.lineTo(x, im.y+im.h); d.stroke(); }
  for (let j=1;j<rows;j++){ const y = im.y + im.h*j/rows; d.beginPath(); d.moveTo(im.x, y); d.lineTo(im.x+im.w, y); d.stroke(); }
  // cell numbers
  d.font = font(500, W*.02, '"IBM Plex Mono", monospace');
  d.textAlign='left'; d.textBaseline='top';
  let n = 1;
  for (let j=0;j<rows;j++) for (let i=0;i<cols;i++){
    d.fillStyle = state.card.accent;
    d.fillText(String(n).padStart(2,'0'), im.x + im.w*i/cols + W*.012, im.y + im.h*j/rows + W*.012);
    n++;
  }
  // header
  d.textAlign='left'; d.textBaseline='middle';
  d.fillStyle = 'rgba(240,240,235,.85)';
  d.font = font(500, W*.022, '"IBM Plex Mono", monospace');
  const title = (state.card.title || 'CONTACT SHEET').toUpperCase();
  d.fillText(fitText(d, title, im.w*.7), im.x, im.y*.5);
  d.textAlign='right';
  d.fillStyle = state.card.accent;
  d.fillText((state.card.caption || 'ROLL 04').toUpperCase(), im.x + im.w, im.y*.5);
}

function drawMuseum(d, base, s){
  const W = base.W, H = base.H, im = base.img;
  // matte board
  const g = d.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#f7f3ea'); g.addColorStop(1,'#e7e0d1');
  d.fillStyle = g; d.fillRect(0,0,W,H);
  d.strokeStyle = 'rgba(0,0,0,.16)'; d.lineWidth=Math.max(1,W*.0012);
  d.strokeRect(.5,.5,W-1,H-1);

  // image with bevel
  d.save();
  d.shadowColor='rgba(0,0,0,.4)'; d.shadowBlur=W*.014; d.shadowOffsetY=W*.004;
  d.fillStyle='#000'; roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.fill();
  d.restore();
  d.save();
  d.strokeStyle='rgba(255,255,255,.5)'; d.lineWidth=Math.max(1,W*.002);
  roundRect(d, im.x-1, im.y-1, im.w+2, im.h+2, base.winRadius); d.stroke();
  d.restore();
  imageInnerShadow(d, im, base.winRadius);

  // caption block
  const cy0 = im.y + im.h;
  const blockH = H - cy0;
  const title = (state.card.title || '').trim();
  const cap = (state.card.caption || '').trim();
  d.textBaseline='middle';
  d.fillStyle = state.card.accent;
  d.fillRect(im.x, cy0 + blockH*.16, W*.05, Math.max(2,W*.004));
  d.textAlign='left';
  if (title){
    d.fillStyle = '#26221d';
    d.font = font(600, W*.036, '"Fraunces", Georgia, serif');
    d.fillText(fitText(d, title, im.w*.8), im.x, cy0 + blockH*.46);
  }
  if (cap){
    d.fillStyle = 'rgba(70,63,54,.72)';
    d.font = font(400, W*.02, '"IBM Plex Mono", monospace');
    d.fillText(fitText(d, cap, im.w*.8), im.x, cy0 + blockH*.72);
  }
}

/* LED date stamp burned into the photo */
function drawDateStamp(d, base, s){
  const im = base.img;
  const px = base.W * .032;
  d.save();
  d.textAlign = 'right'; d.textBaseline = 'alphabetic';
  d.font = font(600, px, '"IBM Plex Mono", monospace');
  const txt = (state.card.caption || '2004 08 14').replace(/[^0-9.\-\/ :]/g,'') || '2004 08 14';
  const x = im.x + im.w - base.W*.028;
  const y = im.y + im.h - base.W*.028;
  d.globalAlpha = .9;
  d.fillStyle = '#ff9a3c';
  d.shadowColor = 'rgba(255,120,20,.9)';
  d.shadowBlur = px*.9;
  d.fillText(txt, x, y);
  d.globalAlpha = .5;
  d.shadowBlur = 0;
  d.fillStyle = '#fff';
  d.fillText(txt, x, y);
  d.restore();
}

/* shrink text to fit a max width */
function fitText(d, text, maxW){
  if (!text) return text;
  if (d.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && d.measureText(t + '…').width > maxW) t = t.slice(0,-1);
  return t + '…';
}

/* ---------------------------------------------------------------
   Card overlay pass (decorations that sit ON TOP of the photo)
   --------------------------------------------------------------- */
function drawCardOverlay(d, base, s){
  const im = base.img;
  imageInnerShadow(d, im, base.winRadius);
  switch (base.cardType){
    case 'film': {
      d.strokeStyle='rgba(255,255,255,.08)'; d.lineWidth=Math.max(1,base.W*.001);
      d.strokeRect(im.x, im.y, im.w, im.h);
      break;
    }
    case 'digicam': {
      // glass reflection
      d.save();
      d.beginPath(); roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.clip();
      const rf = d.createLinearGradient(im.x, im.y, im.x + im.w*.7, im.y + im.h*.8);
      rf.addColorStop(0,'rgba(255,255,255,.13)');
      rf.addColorStop(.45,'rgba(255,255,255,.02)');
      rf.addColorStop(1,'rgba(255,255,255,0)');
      d.fillStyle = rf; d.fillRect(im.x, im.y, im.w, im.h);
      d.restore();
      // recording LED
      d.save();
      d.shadowColor = state.card.accent; d.shadowBlur = base.W*.02;
      d.fillStyle = state.card.accent;
      d.beginPath(); d.arc(im.x + im.w*.03, im.y + im.h*.05, base.W*.012, 0, Math.PI*2); d.fill();
      d.restore();
      break;
    }
    case 'pano': {
      d.save();
      d.beginPath(); roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.clip();
      const sheen = d.createLinearGradient(im.x, im.y + im.h*.35, im.x + im.w, im.y + im.h*.65);
      sheen.addColorStop(0,'rgba(255,255,255,0)');
      sheen.addColorStop(.5,'rgba(255,255,255,.08)');
      sheen.addColorStop(1,'rgba(255,255,255,0)');
      d.fillStyle = sheen; d.fillRect(im.x, im.y, im.w, im.h);
      d.restore();
      break;
    }
    case 'filmstrip': {
      const cols=3, rows=2;
      d.save();
      d.beginPath(); roundRect(d, im.x, im.y, im.w, im.h, base.winRadius); d.clip();
      d.strokeStyle='rgba(8,8,8,.8)'; d.lineWidth=Math.max(2, base.W*.006);
      for (let i=1;i<cols;i++){ const x=im.x+im.w*i/cols; d.beginPath(); d.moveTo(x,im.y); d.lineTo(x,im.y+im.h); d.stroke(); }
      for (let j=1;j<rows;j++){ const y=im.y+im.h*j/rows; d.beginPath(); d.moveTo(im.x,y); d.lineTo(im.x+im.w,y); d.stroke(); }
      d.font = font(500, base.W*.02, '"IBM Plex Mono", monospace');
      d.textAlign='left'; d.textBaseline='top';
      let n=1;
      for (let j=0;j<rows;j++) for (let i=0;i<cols;i++){
        d.fillStyle = state.card.accent;
        d.fillText(String(n).padStart(2,'0'), im.x+im.w*i/cols+base.W*.012, im.y+im.h*j/rows+base.W*.012);
        n++;
      }
      d.restore();
      break;
    }
  }
}

/* ---------------------------------------------------------------
   Layers — text and overlay objects the user adds on top
   --------------------------------------------------------------- */
const LAYER_DEFAULTS = {
  text: {
    kind:'text', text:'double exposure', font:'Inter', weight:700, italic:false,
    size:9, tracking:0, lineHeight:1.15, color:'#ffffff', align:'center',
    x:.5, y:.82, rot:0, opacity:1, blend:'source-over',
    stroke:0, strokeColor:'#111111', shadow:0, shadowColor:'rgba(0,0,0,.6)',
    glow:0, bg:false, bgColor:'rgba(0,0,0,.35)', uppercase:false,
  },
  overlay: {
    kind:'overlay', overlayId:null, x:.5, y:.5, w:.4, rot:0,
    opacity:1, blend:'source-over', flip:false,
  },
};

function uid(){
  return 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function layerByIndex(i){ return state.layers[i] || null; }

function addLayer(kind, extra){
  const base = JSON.parse(JSON.stringify(LAYER_DEFAULTS[kind]));
  const L = Object.assign(base, extra || {}, { id: uid() });
  state.layers.push(L);
  state.selectedLayer = L.id;
  return L;
}

function removeLayer(id){
  const i = state.layers.findIndex(l => l.id === id);
  if (i < 0) return;
  state.layers.splice(i,1);
  if (state.selectedLayer === id) state.selectedLayer = null;
}

function moveLayer(id, dir){
  const i = state.layers.findIndex(l => l.id === id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= state.layers.length) return;
  const [L] = state.layers.splice(i,1);
  state.layers.splice(j,0,L);
}

function duplicateLayer(id){
  const i = state.layers.findIndex(l => l.id === id);
  if (i < 0) return;
  const copy = JSON.parse(JSON.stringify(state.layers[i]));
  copy.id = uid();
  copy.x = clamp(copy.x + .04, 0, 1);
  copy.y = clamp(copy.y + .04, 0, 1);
  state.layers.splice(i+1, 0, copy);
  state.selectedLayer = copy.id;
}

function selectedLayer(){ return state.layers.find(l => l.id === state.selectedLayer) || null; }

/* Draw a single text layer into a rect. `px` scales the design. */
function drawTextLayer(c, L, rect, designW){
  const txt = L.uppercase ? String(L.text).toUpperCase() : String(L.text);
  const size = Math.max(1, designW * (L.size/100));
  const family = FONTS ? FONTS.css(L.font, L.weight, L.italic) : `700 ${size}px sans-serif`;
  c.save();
  c.globalAlpha = clamp(L.opacity, 0, 1);
  c.globalCompositeOperation = L.blend || 'source-over';
  c.translate(rect.cx, rect.cy);
  c.rotate((L.rot||0) * Math.PI/180);
  c.font = family.replace(/\d+(\.\d+)?px/, size + 'px');
  if (L.tracking) c.letterSpacing = (size * L.tracking/100) + 'px';
  c.textAlign = L.align === 'left' ? 'left' : L.align === 'right' ? 'right' : 'center';
  c.textBaseline = 'middle';

  const lines = txt.split('\n');
  const lh = size * (L.lineHeight || 1.15);
  const totalH = lh * lines.length;
  let ox = 0;
  if (L.align === 'left') ox = -rect.w/2;
  else if (L.align === 'right') ox = rect.w/2;

  if (L.bg){
    let maxW = 0;
    for (const ln of lines) maxW = Math.max(maxW, c.measureText(ln).width);
    const padX = size*.4, padY = size*.28;
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = clamp(L.opacity,0,1);
    c.fillStyle = L.bgColor || 'rgba(0,0,0,.35)';
    const bw = maxW + padX*2, bh = totalH + padY*2;
    const bx = L.align === 'left' ? ox - padX : L.align === 'right' ? ox - bw + padX : -bw/2;
    roundRect(c, bx, -bh/2, bw, bh, size*.18);
    c.fill();
    c.restore();
    c.globalAlpha = clamp(L.opacity,0,1);
  }

  lines.forEach((ln, i) => {
    const y = -totalH/2 + lh*(i + .5);
    if (L.glow){
      c.save();
      c.shadowColor = L.color; c.shadowBlur = size * L.glow/100 * 1.6;
      c.fillStyle = L.color; c.fillText(ln, ox, y);
      c.restore();
    }
    if (L.stroke){
      c.lineJoin = 'round'; c.miterLimit = 2;
      c.lineWidth = size * L.stroke/100;
      c.strokeStyle = L.strokeColor;
      c.strokeText(ln, ox, y);
    }
    if (L.shadow){
      c.shadowColor = L.shadowColor; c.shadowBlur = size * L.shadow/100 * .8;
      c.shadowOffsetY = size * L.shadow/100 * .35;
    }
    c.fillStyle = L.color;
    c.fillText(ln, ox, y);
    c.shadowBlur = 0; c.shadowOffsetY = 0;
  });
  c.restore();
}

/* Draw an overlay layer, sized to the layer's w fraction of the frame. */
function drawOverlayLayer(c, L, base){
  const o = OL ? OL.get(L.overlayId) : null;
  if (!o) return;
  const ar = o.w && o.h ? o.w/o.h : 1;
  const fw = base.W, fh = base.H;
  // layer.w is a fraction of the frame's long edge
  const boxW = fw * L.w;
  const boxH = boxW / ar;
  const cx = base.W * L.x, cy = base.H * L.y;
  const cw = Math.max(1, Math.round(boxW));
  const ch = Math.max(1, Math.round(boxH));
  const buf = document.createElement('canvas');
  buf.width = cw; buf.height = ch;
  const bx = buf.getContext('2d');
  try { o.draw(bx, cw, ch, { seed: (L.id||'').length, accent: state.card.accent }); } catch(e){}

  c.save();
  c.globalAlpha = clamp(L.opacity, 0, 1);
  c.globalCompositeOperation = L.blend || 'source-over';
  c.translate(cx, cy);
  c.rotate((L.rot||0) * Math.PI/180);
  if (L.flip) c.scale(-1, 1);
  c.drawImage(buf, -cw/2, -ch/2, cw, ch);
  c.restore();
}

/* A mask overlay clips everything drawn beneath it to its shape. */
function drawMaskLayer(c, L, base){
  const o = OL ? OL.get(L.overlayId) : null;
  if (!o) return;
  const cv = c.canvas;
  const W = cv.width, H = cv.height;
  const scale = W / base.W;

  const snap = document.createElement('canvas');
  snap.width = W; snap.height = H;
  snap.getContext('2d').drawImage(cv, 0, 0);

  const ar = o.w && o.h ? o.w/o.h : 1;
  const boxW = base.W * L.w * scale;
  const boxH = boxW / ar;
  const cx = base.W * L.x * scale;
  const cy = base.H * L.y * scale;

  c.save();
  c.setTransform(1,0,0,1,0,0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0,0,W,H);
  c.drawImage(snap, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.translate(cx, cy);
  c.rotate((L.rot||0) * Math.PI/180);
  try { o.draw(c, boxW, boxH, { seed: 1, accent: state.card.accent }); } catch(e){}
  c.restore();
}

/* All layers, in order. Coordinates are fractions of the frame. */
function drawLayers(c, base, s){
  for (const L of state.layers){
    if (L.hidden) continue;
    if (L.kind === 'text'){
      const rect = { cx: base.W * L.x, cy: base.H * L.y, w: base.W*.9, h: base.H*.3 };
      drawTextLayer(c, L, rect, base.W);
    } else if (L.kind === 'overlay'){
      const o = OL ? OL.get(L.overlayId) : null;
      if (o && o.mask) drawMaskLayer(c, L, base);
      else drawOverlayLayer(c, L, base);
    }
  }
}

/* Convert a pointer position (in canvas CSS px) to layer fractions. */
function pointerToFrame(ev){
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp((ev.clientX - r.left) / r.width, 0, 1),
    y: clamp((ev.clientY - r.top) / r.height, 0, 1),
  };
}

/* Hit-test the topmost layer near a frame point (fractions). */
function hitLayer(fx, fy){
  const base = computeLayout(getAspectRatio(), state.card.type);
  for (let i = state.layers.length - 1; i >= 0; i--){
    const L = state.layers[i];
    if (L.kind === 'text'){
      const size = base.W * (L.size/100);
      const lines = String(L.text).split('\n').length;
      const hw = base.W * .45, hh = Math.max(size*lines*L.lineHeight, size) * .8;
      const dx = (fx - L.x) * base.W, dy = (fy - L.y) * base.H;
      if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return L;
    } else {
      const o = OL ? OL.get(L.overlayId) : null;
      if (!o) continue;
      const ar = o.w && o.h ? o.w/o.h : 1;
      const bw = base.W * L.w, bh = bw/ar;
      const dx = (fx - L.x) * base.W, dy = (fy - L.y) * base.H;
      if (Math.abs(dx) <= bw/2 && Math.abs(dy) <= bh/2) return L;
    }
  }
  return null;
}


/* ---------------------------------------------------------------
   Full render
   --------------------------------------------------------------- */
function getAspectRatio(){
  const a = ASPECTS.find(x => x.id === state.format.aspect);
  if (a && a.r) return a.r;
  if (state.image) return state.image.naturalWidth / state.image.naturalHeight;
  return 4/3;
}

function composeTo(target, long, intensity){
  const k = intensity == null ? 1 : intensity;
  const ar = getAspectRatio();
  const base = computeLayout(ar, state.card.type);
  const scale = long / Math.max(base.W, base.H);
  const W = Math.max(1, Math.round(base.W*scale));
  const H = Math.max(1, Math.round(base.H*scale));

  target.width = W; target.height = H;
  const d = target.getContext('2d');
  d.setTransform(1,0,0,1,0,0);
  d.clearRect(0,0,W,H);
  d.imageSmoothingEnabled = true;
  d.imageSmoothingQuality = 'high';
  d.save();
  d.scale(scale, scale);

  drawCardFrame(d, base, scale);

  if (state.image){
    const styled = buildFrame(base, true);
    let frame = styled;
    if (k < 1){
      const orig = buildFrame(base, false);
      const mix = document.createElement('canvas');
      mix.width = base.W; mix.height = base.H;
      const mx = mix.getContext('2d');
      mx.drawImage(orig, 0, 0);
      mx.globalAlpha = k;
      mx.drawImage(styled, 0, 0);
      frame = mix;
    }
    const im = base.img;
    d.save();
    d.beginPath();
    if (base.winRadius) roundRect(d, im.x, im.y, im.w, im.h, base.winRadius);
    else d.rect(im.x, im.y, im.w, im.h);
    d.clip();
    d.drawImage(frame, im.x, im.y, im.w, im.h, im.x, im.y, im.w, im.h);
    d.restore();

    applyOptics(d, base, scale, frame);
    if (state.optics.stamp) drawDateStamp(d, base, scale);
  }

  drawCardOverlay(d, base, scale);
  drawLayers(d, base, scale);
  d.restore();
  return { W, H, base, scale };
}
/* ---------------------------------------------------------------
   Render loop
   --------------------------------------------------------------- */
function getAspectRatio(){
  const a = ASPECTS.find(x => x.id === state.format.aspect);
  if (a && a.r) return a.r;
  if (state.image) return state.image.naturalWidth / state.image.naturalHeight;
  return 4/3;
}

let rafPending = false;
function scheduleRender(){
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; renderNow(); });
}

function renderNow(){
  if (!state.image) return;
  const k = state.compare ? 0 : state.intensity/100;
  const r = composeTo(canvas, RENDER_LONG, k);
  canvasWrap.hidden = false;
  emptyState.hidden = true;
  stageFoot.hidden = false;
  $('#srcMeta').textContent = `${state.imageName || 'photo'} · ${state.image.naturalWidth}×${state.image.naturalHeight}`;
  const p = activePreset();
  $('#outMeta').textContent = `${r.W}×${r.H} · ${p ? p.name : '—'} · ${state.card.type}`;
}

/* ---------------------------------------------------------------
   Thumbnails
   --------------------------------------------------------------- */
function renderThumb(cv, p){
  const s = cv.width, d = cv.getContext('2d');
  d.setTransform(1,0,0,1,0,0);
  d.clearRect(0,0,s,s);
  const src = state.sampleImg;
  if (src && src.complete && src.naturalWidth){
    const k = Math.max(s/src.naturalWidth, s/src.naturalHeight);
    const w = src.naturalWidth*k, h = src.naturalHeight*k;
    d.filter = p.f || 'none';
    d.drawImage(src, (s-w)/2, (s-h)/2, w, h);
    d.filter = 'none';
  } else {
    const g = d.createLinearGradient(0,0,s,s);
    g.addColorStop(0,'#5a6b7a'); g.addColorStop(1,'#2a2f38');
    d.fillStyle=g; d.fillRect(0,0,s,s);
  }
  if (p.fx && window.applyEffects){
    const t = window.applyEffects(cv, p.fx);
    if (t !== cv){ d.clearRect(0,0,s,s); d.drawImage(t,0,0); }
  }
  if (p.h){ d.globalCompositeOperation='screen';  d.fillStyle=p.h; d.fillRect(0,0,s,s); }
  if (p.t){ d.globalCompositeOperation='overlay'; d.fillStyle=p.t; d.fillRect(0,0,s,s); }
  if (p.l){ d.globalCompositeOperation='multiply';d.fillStyle=p.l; d.fillRect(0,0,s,s); }
  d.globalCompositeOperation='source-over';
  const v = p.vig ?? .25;
  const rg = d.createRadialGradient(s/2,s/2,s*.15, s/2,s/2,s*.78);
  rg.addColorStop(0,'rgba(0,0,0,0)');
  rg.addColorStop(1,`rgba(0,0,0,${v*.8})`);
  d.fillStyle=rg; d.fillRect(0,0,s,s);
}

/* ---------------------------------------------------------------
   Procedural sample photo
   --------------------------------------------------------------- */
function makeSampleDataURL(){
  const W = 1200, H = 800;
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const d = c.getContext('2d');
  const sky = d.createLinearGradient(0,0,0,H*.72);
  sky.addColorStop(0,'#1b2a4a'); sky.addColorStop(.45,'#7a5c86');
  sky.addColorStop(.72,'#e88a5a'); sky.addColorStop(1,'#f6c98a');
  d.fillStyle=sky; d.fillRect(0,0,W,H*.72);
  const sun = d.createRadialGradient(W*.68,H*.44,10,W*.68,H*.44,H*.42);
  sun.addColorStop(0,'rgba(255,240,200,.98)');
  sun.addColorStop(.18,'rgba(255,190,120,.85)');
  sun.addColorStop(1,'rgba(255,150,90,0)');
  d.fillStyle=sun; d.fillRect(0,0,W,H*.72);
  function ridge(baseY, amp, color, seed){
    const rnd = mulberry32(seed);
    d.beginPath(); d.moveTo(0,H); d.lineTo(0, baseY);
    for (let x=0;x<=W;x+=24){
      d.lineTo(x, baseY - Math.sin(x*0.006+seed)*amp - rnd()*amp*.6);
    }
    d.lineTo(W,H); d.closePath(); d.fillStyle=color; d.fill();
  }
  ridge(H*.6, 70, '#4a3b58', 3);
  ridge(H*.66, 48, '#33283f', 9);
  ridge(H*.71, 30, '#221b2c', 17);
  const water = d.createLinearGradient(0,H*.72,0,H);
  water.addColorStop(0,'#3a2f3f'); water.addColorStop(1,'#141018');
  d.fillStyle=water; d.fillRect(0,H*.72,W,H*.28);
  for (let i=0;i<60;i++){
    const y = H*.72 + i*(H*.28/60);
    const w = (1-i/60)*W*.28 + 8;
    d.fillStyle = `rgba(255,190,130,${(1-i/60)*.28})`;
    d.fillRect(W*.68 - w/2, y, w, 2);
  }
  d.fillStyle='#0c0a12';
  d.beginPath(); d.moveTo(0,H); d.lineTo(0,H*.9);
  for (let x=0;x<=W;x+=40){ d.lineTo(x, H*.9 - Math.sin(x*0.01)*8 - (x>W*.75? 20:0)); }
  d.lineTo(W,H); d.closePath(); d.fill();
  function tree(x, h){
    d.fillStyle='#08070c';
    d.beginPath(); d.moveTo(x, H*.92); d.lineTo(x-h*.18, H*.92);
    d.lineTo(x-h*.09, H*.92-h); d.lineTo(x, H*.92-h*.7);
    d.lineTo(x+h*.09, H*.92-h); d.lineTo(x+h*.18, H*.92);
    d.closePath(); d.fill();
  }
  tree(W*.12, H*.28); tree(W*.2, H*.2); tree(W*.88, H*.24);
  const img = d.getImageData(0,0,W,H);
  const rnd = mulberry32(7);
  for (let i=0;i<img.data.length;i+=4){
    const n=(rnd()-.5)*10;
    img.data[i]+=n; img.data[i+1]+=n; img.data[i+2]+=n;
  }
  d.putImageData(img,0,0);
  return c.toDataURL('image/jpeg',.92);
}

/* ---------------------------------------------------------------
   Preset browser
   --------------------------------------------------------------- */
let gridObserver = null;

function currentList(){
  const q = state.search.trim().toLowerCase();
  if (q){
    return Object.keys(LIB.all).map(k => LIB.all[k])
      .filter(p => p.name.toLowerCase().includes(q) || p.collection.includes(q));
  }
  if (state.collection === 'favorites'){
    return state.favorites.map(presetById).filter(Boolean);
  }
  if (state.collection === 'recent'){
    return state.recent.map(presetById).filter(Boolean);
  }
  const c = LIB.collections.find(x => x.id === state.collection);
  return c ? c.ids.map(presetById).filter(Boolean) : [];
}

function buildGrid(){
  const list = currentList();
  gridLabel.textContent = `${list.length} ${list.length === 1 ? 'look' : 'looks'}`;
  presetGrid.innerHTML = '';
  if (gridObserver) gridObserver.disconnect();

  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting){
        const el = en.target;
        io.unobserve(el);
        const p = presetById(el.dataset.id);
        if (p) renderThumb(el.querySelector('canvas'), p);
      }
    });
  }, { root: presetGrid, rootMargin: '300px 0px' });
  gridObserver = io;

  const frag = document.createDocumentFragment();
  list.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset' + (state.preset && state.preset.id === p.id ? ' is-active' : '');
    b.dataset.id = p.id;
    const cv = document.createElement('canvas');
    cv.width = 108; cv.height = 108;
    const nm = document.createElement('span');
    nm.textContent = p.name;
    const fav = document.createElement('i');
    fav.className = 'fav' + (state.favorites.includes(p.id) ? ' on' : '');
    fav.textContent = state.favorites.includes(p.id) ? '★' : '☆';
    fav.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(p.id, fav); });
    b.append(cv, nm, fav);
    b.addEventListener('click', () => selectPreset(p.id));
    frag.appendChild(b);
    io.observe(b);
  });
  presetGrid.appendChild(frag);
}

function toggleFavorite(id, el){
  const i = state.favorites.indexOf(id);
  if (i >= 0) state.favorites.splice(i,1); else state.favorites.unshift(id);
  if (el){ const on = state.favorites.includes(id); el.classList.toggle('on', on); el.textContent = on ? '★' : '☆'; }
  saveLocal();
  if (state.collection === 'favorites') buildGrid();
}

function selectPreset(id){
  const p = presetById(id);
  if (!p) return;
  applyPresetObject(p);
  state.recent = [id].concat(state.recent.filter(x => x !== id)).slice(0, 30);
  buildSliders(slidersEl, TONE_SLIDERS, state.tone);
  buildSliders(opticSlidersEl, OPTIC_SLIDERS, state.optics);
  syncToggles();
  [...presetGrid.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
  $('#presetName').textContent = p.name;
  $('#presetColl').textContent = (LIB.collections.find(c => c.id === p.collection) || {}).name || '';
  saveLocal();
  scheduleRender();
}

function buildCollNav(){
  const items = [
    { id:'favorites', name:'★ Favorites' },
    { id:'recent',    name:'↺ Recent' },
  ].concat(LIB.collections.map(c => ({ id:c.id, name:c.name })));
  collNav.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'coll' + (state.collection === it.id ? ' is-active' : '');
    b.textContent = it.name;
    b.dataset.id = it.id;
    b.addEventListener('click', () => {
      state.collection = it.id;
      state.search = '';
      $('#searchInput').value = '';
      [...collNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === it.id));
      buildGrid();
    });
    collNav.appendChild(b);
  });
}

function surpriseMe(){
  const pool = LIB.collections;
  const c = pool[Math.floor(Math.random()*pool.length)];
  const id = c.ids[Math.floor(Math.random()*c.ids.length)];
  state.collection = c.id;
  state.search = '';
  $('#searchInput').value = '';
  [...collNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === c.id));
  buildGrid();
  selectPreset(id);
  toast('Surprise: ' + (presetById(id)||{}).name);
}

/* ---------------------------------------------------------------
   Sliders, pills, toggles
   --------------------------------------------------------------- */
const TONE_SLIDERS = [
  { k:'exposure',    label:'Exposure',  min:-100, max:100 },
  { k:'contrast',    label:'Contrast',  min:-100, max:100 },
  { k:'saturation',  label:'Saturation',min:-100, max:100 },
  { k:'temperature', label:'Warmth',    min:-100, max:100 },
  { k:'tint',        label:'Tint',      min:-100, max:100 },
  { k:'fade',        label:'Fade',      min:0,    max:100 },
];
const OPTIC_SLIDERS = [
  { k:'vignette',  label:'Vignette',  min:0, max:100 },
  { k:'grain',     label:'Grain',     min:0, max:100 },
  { k:'bloom',     label:'Bloom',     min:0, max:100 },
  { k:'halation',  label:'Halation',  min:0, max:100 },
  { k:'chromatic', label:'CCD Fringe',min:0, max:100 },
  { k:'scanlines', label:'Scanlines', min:0, max:100 },
];

function fmtVal(v){ return (v > 0 ? '+' : '') + Math.round(v); }

function buildSliders(host, defs, obj){
  host.innerHTML = '';
  defs.forEach(def => {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    const top = document.createElement('div');
    top.className = 'slider-top';
    const b = document.createElement('b'); b.textContent = def.label;
    const i = document.createElement('i'); i.textContent = fmtVal(obj[def.k] ?? 0);
    top.append(b, i);
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = def.min; inp.max = def.max; inp.step = 1;
    inp.value = obj[def.k] ?? 0;
    inp.dataset.key = def.k;
    inp.addEventListener('input', () => {
      obj[def.k] = +inp.value;
      i.textContent = fmtVal(+inp.value);
      scheduleRender();
    });
    inp.addEventListener('dblclick', () => {
      inp.value = 0; obj[def.k] = 0; i.textContent = fmtVal(0); scheduleRender();
    });
    wrap.append(top, inp);
    host.appendChild(wrap);
  });
}

function refreshSliderValues(){
  [ [slidersEl, state.tone], [opticSlidersEl, state.optics] ].forEach(([host, obj]) => {
    [...host.querySelectorAll('input')].forEach(inp => {
      const k = inp.dataset.key;
      if (k in obj){ inp.value = obj[k]; inp.previousElementSibling.querySelector('i').textContent = fmtVal(obj[k]); }
    });
  });
}

function buildPills(host, items, getActive, onPick){
  host.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.dataset.id = it.id;
    b.textContent = it.label;
    b.addEventListener('click', () => onPick(it.id));
    host.appendChild(b);
  });
  host._sync = () => {
    const a = getActive();
    [...host.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === a));
  };
  host._sync();
}

function syncToggles(){
  $('#flashToggle').checked = !!state.optics.flash;
  $('#stampToggle').checked = !!state.optics.stamp;
  $('#scanToggle').checked  = !!state.optics.scanlines > 0;
}

/* ---------------------------------------------------------------
   Local persistence for favourites and recents
   --------------------------------------------------------------- */
function saveLocal(){
  try {
    localStorage.setItem('halide.fav', JSON.stringify(state.favorites));
    localStorage.setItem('halide.recent', JSON.stringify(state.recent));
  } catch(e){}
}
function loadLocal(){
  try {
    state.favorites = JSON.parse(localStorage.getItem('halide.fav') || '[]');
    state.recent = JSON.parse(localStorage.getItem('halide.recent') || '[]');
  } catch(e){ state.favorites = []; state.recent = []; }
}

/* ---------------------------------------------------------------
   Image loading
   --------------------------------------------------------------- */
function loadFromFile(file){
  if (!file) return;
  if (!file.type.startsWith('image/')){ toast('That file is not an image.'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.imageName = file.name.replace(/\.[^.]+$/, '');
    URL.revokeObjectURL(url);
    onImageReady();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image.'); };
  img.src = url;
}
function loadFromDataURL(url, name){
  const img = new Image();
  img.onload = () => { state.image = img; state.imageName = name || 'sample'; onImageReady(); };
  img.onerror = () => toast('Could not load the sample.');
  img.src = url;
}
function onImageReady(){
  emptyState.hidden = true;
  canvasWrap.hidden = false;
  $('#exportBtn').disabled = false;
  $('#downloadBtn').disabled = false;
  renderNow();
  toast('Loaded ' + state.imageName);
}
function resetAll(){
  state.image = null; state.imageName = '';
  canvasWrap.hidden = true; emptyState.hidden = false; stageFoot.hidden = true;
  $('#exportBtn').disabled = true; $('#downloadBtn').disabled = true;
  state.intensity = 100; state.texture = null; state.compare = false;
  state.tone = { ...DEFAULT_TONE };
  state.optics = { vignette:0, grain:0, bloom:0, halation:0, haloTint:'rgba(255,150,90,.45)',
    chromatic:0, scanlines:0, sharpen:0, temp:0, fade:0, flash:false, stamp:false, scanToggle:false, digitize:false };
  state.card = { type:'polaroid', title:'', caption:'', accent:'#ff7a29' };
  state.layers = []; state.selectedLayer = null;
  $('#titleInput').value = ''; $('#captionInput').value = '';
  $('#accentInput').value = '#ff7a29'; $('#accentHex').textContent = '#ff7a29';
  $('#sampleToggle').checked = false;
  state.format = { aspect:'auto', fit:'cover' };
  state.size = 'card'; state.fmt = 'png';
  $('#intensity').value = 100; $('#intensityVal').textContent = '100';
  cardPills._sync(); aspectPills._sync(); fitPills._sync(); sizePills._sync(); fmtPills._sync(); texturePills._sync();
  buildSliders(slidersEl, TONE_SLIDERS, state.tone);
  buildSliders(opticSlidersEl, OPTIC_SLIDERS, state.optics);
  syncToggles();
  renderLayerList();
  syncLayerUI();
  selectPreset('kodachrome');
}

/* ---------------------------------------------------------------
   Export
   --------------------------------------------------------------- */
function exportBlob(){
  return new Promise(resolve => {
    const long = (SIZES.find(s => s.id === state.size) || SIZES[0]).long;
    const out = document.createElement('canvas');
    composeTo(out, long, state.intensity/100);
    const type = state.fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    out.toBlob(blob => resolve({ blob, w: out.width, h: out.height }), type, state.quality);
  });
}
async function download(){
  if (!state.image) return;
  toast('Rendering…');
  try {
    const { blob, w, h } = await exportBlob();
    const a = document.createElement('a');
    const name = (state.card.title || state.imageName || 'halide').trim()
      .replace(/[^\w\-. ]+/g,'').replace(/\s+/g,'-').toLowerCase() || 'halide';
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${(activePreset()||{}).id || 'look'}-${w}x${h}.${state.fmt}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`Saved ${w}×${h} ${state.fmt.toUpperCase()}`);
  } catch(e){ toast('Export failed: ' + e.message); }
}

/* ---------------------------------------------------------------
   Layer UI — the text editor, the layer list, the overlay grid
   --------------------------------------------------------------- */
function layerLabel(L){
  if (L.kind === 'text') return L.text ? L.text.split('\n')[0].slice(0,22) : '(empty text)';
  const o = OL ? OL.get(L.overlayId) : null;
  return o ? o.name : 'overlay';
}

function renderLayerList(){
  if (!layerList) return;
  layerList.innerHTML = '';
  const sel = selectedLayer();
  if (!state.layers.length){
    layerList.hidden = true;
    return;
  }
  layerList.hidden = false;
  [...state.layers].reverse().forEach(L => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'layer-row' + (L.id === state.selectedLayer ? ' is-sel' : '');
    row.dataset.id = L.id;
    const kind = document.createElement('span');
    kind.className = 'layer-kind';
    kind.textContent = L.kind === 'text' ? 'T' : 'O';
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layerLabel(L);
    const eye = document.createElement('span');
    eye.className = 'layer-eye';
    eye.textContent = L.hidden ? '◌' : '◉';
    eye.title = 'Show/hide';
    eye.addEventListener('click', e => {
      e.stopPropagation();
      L.hidden = !L.hidden;
      renderLayerList(); scheduleRender();
    });
    row.append(kind, name, eye);
    row.addEventListener('click', () => {
      state.selectedLayer = L.id;
      syncLayerUI();
      scheduleRender();
    });
    layerList.appendChild(row);
  });
}

function syncLayerUI(){
  const L = selectedLayer();
  const isText = L && L.kind === 'text';
  const isOv = L && L.kind === 'overlay';
  if (textEditor) textEditor.hidden = !isText;
  if (overlayEditor) overlayEditor.hidden = !isOv;
  if ($('#textHint')) $('#textHint').hidden = !!isText;
  if ($('#overlayHint')) $('#overlayHint').hidden = !!isOv;
  if (isOv) syncOverlayUI(L);
  if (!isText) return;

  $('#textContent').value = L.text;
  $('#fontCurrent').textContent = L.font;
  const fm = FONTS ? FONTS.get(L.font) : null;
  $('#fontCatLabel').textContent = fm ? fm.catName : '';
  $('#textSize').value = L.size;       $('#textSizeVal').textContent = L.size;
  $('#textWeight').value = L.weight;   $('#textWeightVal').textContent = L.weight;
  $('#textTrack').value = L.tracking;  $('#textTrackVal').textContent = L.tracking;
  $('#textLh').value = L.lineHeight;   $('#textLhVal').textContent = L.lineHeight;
  $('#textRot').value = L.rot;         $('#textRotVal').textContent = L.rot;
  $('#textOp').value = Math.round(L.opacity*100); $('#textOpVal').textContent = Math.round(L.opacity*100);
  $('#textStroke').value = L.stroke;   $('#textStrokeVal').textContent = L.stroke;
  $('#textShadow').value = L.shadow;   $('#textShadowVal').textContent = L.shadow;
  $('#textGlow').value = L.glow;       $('#textGlowVal').textContent = L.glow;
  $('#textColor').value = toHex(L.color);
  $('#textStrokeColor').value = toHex(L.strokeColor);
  $('#textItalic').checked = !!L.italic;
  $('#textUpper').checked = !!L.uppercase;
  $('#textBg').checked = !!L.bg;
  $('#textAlignPills')._sync();
  $('#textBlendPills')._sync();
  // load the face so the canvas has it before we paint
  if (FONTS) FONTS.load(L.font, L.weight, L.italic).then(() => scheduleRender());
}

function syncOverlayUI(L){
  $('#ovScale').value = Math.round(L.w*100); $('#ovScaleVal').textContent = Math.round(L.w*100);
  $('#ovRot').value = L.rot;   $('#ovRotVal').textContent = L.rot;
  $('#ovOp').value = Math.round(L.opacity*100); $('#ovOpVal').textContent = Math.round(L.opacity*100);
  $('#ovFlip').checked = !!L.flip;
  $('#ovBlendPills')._sync();
}

function toHex(c){
  if (!c) return '#ffffff';
  if (c[0] === '#'){
    if (c.length === 4) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
    return c.slice(0,7);
  }
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#ffffff';
  const h = n => (+n).toString(16).padStart(2,'0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

function addTextLayer(){
  const L = addLayer('text', {});
  renderLayerList();
  syncLayerUI();
  scheduleRender();
  if (FONTS) FONTS.load(L.font, L.weight, false).then(() => scheduleRender());
}

function buildOverlayNav(){
  if (!overlayNav || !OL) return;
  overlayNav.innerHTML = '';
  const mk = (id, name, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'coll';
    b.dataset.id = id;
    b.innerHTML = name + (count != null ? ` <span class="mono dim">${count}</span>` : '');
    b.addEventListener('click', () => {
      state.overlayCat = id;
      [...overlayNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
      buildOverlayGrid();
    });
    overlayNav.appendChild(b);
    return b;
  };
  mk('all', 'All', OL.count);
  OL.cats.forEach(c => mk(c.id, c.name, c.count));
  const first = overlayNav.firstChild;
  if (first){ first.classList.add('is-active'); state.overlayCat = 'all'; }
}

function overlayList(){
  if (!OL) return [];
  const q = (state.overlaySearch || '').trim().toLowerCase();
  // a search spans the whole library; the category filter only applies to browsing
  if (q) return OL.all.filter(o =>
    o.name.toLowerCase().includes(q) || o.cat.toLowerCase().includes(q));
  let list = state.overlayCat && state.overlayCat !== 'all'
    ? OL.all.filter(o => slug(o.cat) === state.overlayCat)
    : OL.all;
  return list;
}

function buildOverlayGrid(){
  if (!overlayGrid || !OL) return;
  overlayGrid.innerHTML = '';
  const list = overlayList();
  const frag = document.createDocumentFragment();
  list.forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ov-cell';
    b.title = o.cat + ' — ' + o.name;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = o.name;
    img.src = OL.thumb(o.id, 72);
    const cap = document.createElement('span');
    cap.textContent = o.name;
    b.append(img, cap);
    b.addEventListener('click', () => {
      const L = addLayer('overlay', { overlayId: o.id, w: o.w || .4 });
      renderLayerList();
      syncLayerUI();
      scheduleRender();
      toast('Added ' + o.name);
    });
    frag.appendChild(b);
  });
  overlayGrid.appendChild(frag);
}

/* ---- Font picker modal ---- */
let fontRenderTimer = null;
function buildFontNav(){
  if (!fontNav || !FONTS) return;
  fontNav.innerHTML = '';
  const mk = (id, name, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'coll';
    b.dataset.id = id;
    b.innerHTML = name + (count != null ? ` <span class="mono dim">${count}</span>` : '');
    b.addEventListener('click', () => {
      state.fontCat = id;
      [...fontNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
      renderFontGrid();
    });
    fontNav.appendChild(b);
  };
  mk('all', 'All', FONTS.count);
  FONTS.cats.forEach(c => mk(c.id, c.name, c.count));
  fontNav.firstChild.classList.add('is-active');
  state.fontCat = 'all';
}

function fontList(){
  if (!FONTS) return [];
  const q = (state.fontSearch || '').trim().toLowerCase();
  // a search spans the whole catalogue; the category filter only applies to browsing
  if (q) return FONTS.all.filter(f =>
    f.name.toLowerCase().includes(q) || f.catName.toLowerCase().includes(q));
  let list = FONTS.all;
  if (state.fontCat && state.fontCat !== 'all') list = list.filter(f => f.cat === state.fontCat);
  return list;
}

function renderFontGrid(){
  if (!fontGrid || !FONTS) return;
  const list = fontList();
  fontGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  const slice = list.slice(0, 300);
  slice.forEach(f => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-cell';
    b.dataset.font = f.name;
    const sample = document.createElement('span');
    sample.className = 'font-sample';
    sample.style.fontFamily = `"${f.name}", ${f.fallback}`;
    sample.textContent = f.name;
    const meta = document.createElement('span');
    meta.className = 'font-meta mono dim';
    meta.textContent = f.catName;
    b.append(sample, meta);
    // lazily load the actual face for the preview
    b.addEventListener('mouseenter', () => {
      FONTS.load(f.name, 400, false).then(() => {
        sample.style.fontFamily = `"${f.name}", ${f.fallback}`;
      });
    }, { once:true });
    b.addEventListener('click', () => {
      const L = selectedLayer();
      if (L && L.kind === 'text'){
        L.font = f.name;
        FONTS.load(f.name, L.weight, L.italic).then(() => { scheduleRender(); });
        syncLayerUI();
        scheduleRender();
      }
      closeFontModal();
      toast('Font: ' + f.name);
    });
    frag.appendChild(b);
  });
  if (list.length > slice.length){
    const more = document.createElement('p');
    more.className = 'fineprint';
    more.textContent = `Showing ${slice.length} of ${list.length} — keep typing to narrow it down.`;
    fontGrid.appendChild(frag);
    fontGrid.appendChild(more);
  } else {
    fontGrid.appendChild(frag);
  }
}

function openFontModal(){
  fontModal.hidden = false;
  document.body.classList.add('is-modal');
  $('#fontCount').textContent = FONTS.count + ' families';
  const L = selectedLayer();
  if (L && L.kind === 'text'){
    state.fontSearch = '';
    $('#fontSearch').value = '';
    // jump to the layer's current category
    const fm = FONTS.get(L.font);
    state.fontCat = fm ? fm.cat : 'all';
    [...fontNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === state.fontCat));
  }
  renderFontGrid();
  setTimeout(() => $('#fontSearch').focus(), 40);
}
function closeFontModal(){
  fontModal.hidden = true;
  document.body.classList.remove('is-modal');
}

/* ---- drag layers around the stage ---- */
function wireLayerDrag(){
  let dragging = null, moved = false;
  canvas.addEventListener('pointerdown', e => {
    if (!state.image) return;
    const p = pointerToFrame(e);
    const L = hitLayer(p.x, p.y);
    if (!L) return;
    dragging = { L, dx: L.x - p.x, dy: L.y - p.y };
    moved = false;
    state.selectedLayer = L.id;
    canvas.setPointerCapture(e.pointerId);
    syncLayerUI();
    renderLayerList();
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const p = pointerToFrame(e);
    dragging.L.x = clamp(p.x + dragging.dx, -0.2, 1.2);
    dragging.L.y = clamp(p.y + dragging.dy, -0.2, 1.2);
    moved = true;
    scheduleRender();
  });
  const end = e => {
    if (!dragging) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch(err){}
    dragging = null;
    if (moved) renderLayerList();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  window.addEventListener('keydown', e => {
    const L = selectedLayer();
    if (!L) return;
    if (document.body.classList.contains('is-modal')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const step = e.shiftKey ? .02 : .005;
    if (e.key === 'ArrowLeft'){ L.x = clamp(L.x-step, -0.2, 1.2); scheduleRender(); e.preventDefault(); }
    else if (e.key === 'ArrowRight'){ L.x = clamp(L.x+step, -0.2, 1.2); scheduleRender(); e.preventDefault(); }
    else if (e.key === 'ArrowUp'){ L.y = clamp(L.y-step, -0.2, 1.2); scheduleRender(); e.preventDefault(); }
    else if (e.key === 'ArrowDown'){ L.y = clamp(L.y+step, -0.2, 1.2); scheduleRender(); e.preventDefault(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey){
      removeLayer(L.id); renderLayerList(); syncLayerUI(); scheduleRender(); e.preventDefault();
    }
  });
}

function wireLayerUI(){
  buildPills($('#textAlignPills'),
    [{id:'left',label:'Left'},{id:'center',label:'Center'},{id:'right',label:'Right'}],
    () => (selectedLayer()||{}).align || 'center',
    id => { const L = selectedLayer(); if (L){ L.align = id; $('#textAlignPills')._sync(); scheduleRender(); } });
  buildPills($('#textBlendPills'),
    [{id:'source-over',label:'Normal'},{id:'multiply',label:'Multiply'},{id:'screen',label:'Screen'},
     {id:'overlay',label:'Overlay'},{id:'soft-light',label:'Soft'},{id:'difference',label:'Diff'}],
    () => (selectedLayer()||{}).blend || 'source-over',
    id => { const L = selectedLayer(); if (L){ L.blend = id; $('#textBlendPills')._sync(); scheduleRender(); } });

  buildPills($('#ovBlendPills'),
    [{id:'source-over',label:'Normal'},{id:'multiply',label:'Multiply'},{id:'screen',label:'Screen'},
     {id:'overlay',label:'Overlay'},{id:'soft-light',label:'Soft'},{id:'difference',label:'Diff'}],
    () => (selectedLayer()||{}).blend || 'source-over',
    id => { const L = selectedLayer(); if (L){ L.blend = id; $('#ovBlendPills')._sync(); scheduleRender(); } });

  const bindOv = (sel, key, scale, fmt) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', () => {
      const L = selectedLayer();
      if (!L || L.kind !== 'overlay') return;
      L[key] = scale ? +el.value/scale : +el.value;
      const valEl = $(sel + 'Val');
      if (valEl) valEl.textContent = fmt ? fmt(L[key]) : Math.round(L[key]);
      scheduleRender();
    });
  };
  bindOv('#ovScale', 'w', 100);
  bindOv('#ovRot', 'rot', 1);
  bindOv('#ovOp', 'opacity', 100);
  $('#ovFlip').addEventListener('change', e => {
    const L = selectedLayer(); if (L) { L.flip = e.target.checked; scheduleRender(); }
  });
  $('#ovDelBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    removeLayer(L.id); renderLayerList(); syncLayerUI(); scheduleRender();
  });
  $('#ovDupBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    duplicateLayer(L.id); renderLayerList(); syncLayerUI(); scheduleRender();
  });
  $('#ovUpBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    moveLayer(L.id, 1); renderLayerList(); scheduleRender();
  });
  $('#ovDownBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    moveLayer(L.id, -1); renderLayerList(); scheduleRender();
  });

  const bindText = (sel, key, scale, fmt) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', () => {
      const L = selectedLayer();
      if (!L || L.kind !== 'text') return;
      L[key] = scale ? +el.value/scale : +el.value;
      const valEl = $(sel + 'Val');
      if (valEl) valEl.textContent = fmt ? fmt(L[key]) : L[key];
      scheduleRender();
    });
  };
  $('#textContent').addEventListener('input', e => {
    const L = selectedLayer();
    if (!L || L.kind !== 'text') return;
    L.text = e.target.value;
    renderLayerList();
    scheduleRender();
  });
  bindText('#textSize', 'size', 1);
  bindText('#textWeight', 'weight', 1);
  bindText('#textTrack', 'tracking', 1);
  bindText('#textLh', 'lineHeight', 1);
  bindText('#textRot', 'rot', 1);
  bindText('#textOp', 'opacity', 100);
  bindText('#textStroke', 'stroke', 1);
  bindText('#textShadow', 'shadow', 1);
  bindText('#textGlow', 'glow', 1);

  $('#textColor').addEventListener('input', e => {
    const L = selectedLayer(); if (L) { L.color = e.target.value; scheduleRender(); }
  });
  $('#textStrokeColor').addEventListener('input', e => {
    const L = selectedLayer(); if (L) { L.strokeColor = e.target.value; scheduleRender(); }
  });
  $('#textItalic').addEventListener('change', e => {
    const L = selectedLayer(); if (!L) return;
    L.italic = e.target.checked;
    if (FONTS) FONTS.load(L.font, L.weight, L.italic).then(() => scheduleRender());
    scheduleRender();
  });
  $('#textUpper').addEventListener('change', e => {
    const L = selectedLayer(); if (L) { L.uppercase = e.target.checked; scheduleRender(); }
  });
  $('#textBg').addEventListener('change', e => {
    const L = selectedLayer(); if (L) { L.bg = e.target.checked; scheduleRender(); }
  });

  $('#addTextBtn').addEventListener('click', addTextLayer);
  $('#textDelBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    removeLayer(L.id); renderLayerList(); syncLayerUI(); scheduleRender();
  });
  $('#textDupBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    duplicateLayer(L.id); renderLayerList(); syncLayerUI(); scheduleRender();
  });
  $('#textUpBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    moveLayer(L.id, 1); renderLayerList(); scheduleRender();
  });
  $('#textDownBtn').addEventListener('click', () => {
    const L = selectedLayer(); if (!L) return;
    moveLayer(L.id, -1); renderLayerList(); scheduleRender();
  });

  $('#fontOpenBtn').addEventListener('click', openFontModal);
  $('#fontCloseBtn').addEventListener('click', closeFontModal);
  $('#fontBackdrop').addEventListener('click', closeFontModal);
  $('#fontSearch').addEventListener('input', e => {
    state.fontSearch = e.target.value;
    clearTimeout(fontRenderTimer);
    fontRenderTimer = setTimeout(renderFontGrid, 90);
  });

  $('#overlaySearch').addEventListener('input', e => {
    state.overlaySearch = e.target.value;
    buildOverlayGrid();
  });
  $('#clearOverlaysBtn').addEventListener('click', () => {
    state.layers = state.layers.filter(l => l.kind !== 'overlay');
    state.selectedLayer = null;
    renderLayerList(); syncLayerUI(); scheduleRender();
    toast('Overlays cleared');
  });
}

/* ---------------------------------------------------------------
   Wiring
   --------------------------------------------------------------- */
function wire(){
  document.querySelectorAll('.mode').forEach(b => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });

  const openPicker = () => fileInput.click();
  $('#pickBtn').addEventListener('click', openPicker);
  fileInput.addEventListener('change', e => { loadFromFile(e.target.files[0]); fileInput.value=''; });

  ['dragenter','dragover'].forEach(ev => stage.addEventListener(ev, e => {
    e.preventDefault(); stage.classList.add('is-drag');
  }));
  ['dragleave','drop'].forEach(ev => stage.addEventListener(ev, e => {
    e.preventDefault();
    if (ev === 'dragleave' && stage.contains(e.relatedTarget)) return;
    stage.classList.remove('is-drag');
  }));
  stage.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) loadFromFile(f); });
  window.addEventListener('paste', e => {
    for (const it of (e.clipboardData?.items || [])){
      if (it.type.startsWith('image/')){ loadFromFile(it.getAsFile()); break; }
    }
  });

  $('#sampleToggle').addEventListener('change', e => {
    if (e.target.checked) loadFromDataURL(makeSampleDataURL(), 'sample-frame');
    else resetAll();
  });

  $('#searchInput').addEventListener('input', e => {
    state.search = e.target.value;
    buildGrid();
  });
  $('#surpriseBtn').addEventListener('click', surpriseMe);

  buildPills(cardPills, CARD_TYPES, () => state.card.type, id => {
    state.card.type = id; cardPills._sync(); scheduleRender();
  });
  buildPills(aspectPills, ASPECTS, () => state.format.aspect, id => {
    state.format.aspect = id; aspectPills._sync(); scheduleRender();
  });
  buildPills(fitPills, [{id:'cover',label:'Fill'},{id:'contain',label:'Fit'}],
    () => state.format.fit, id => { state.format.fit = id; fitPills._sync(); scheduleRender(); });
  buildPills(sizePills, SIZES, () => state.size, id => { state.size = id; sizePills._sync(); });
  buildPills(fmtPills, [{id:'png',label:'PNG'},{id:'jpg',label:'JPG'}],
    () => state.fmt, id => { state.fmt = id; fmtPills._sync(); });
  buildPills(texturePills, TEXTURES, () => state.texture || 'none', id => {
    state.texture = id === 'none' ? null : id;
    texturePills._sync();
    scheduleRender();
  });

  $('#intensity').addEventListener('input', e => {
    state.intensity = +e.target.value;
    $('#intensityVal').textContent = String(state.intensity);
    scheduleRender();
  });

  $('#titleInput').addEventListener('input', e => { state.card.title = e.target.value; scheduleRender(); });
  $('#captionInput').addEventListener('input', e => { state.card.caption = e.target.value; scheduleRender(); });
  $('#accentInput').addEventListener('input', e => {
    state.card.accent = e.target.value;
    $('#accentHex').textContent = e.target.value;
    scheduleRender();
  });

  $('#flashToggle').addEventListener('change', e => { state.optics.flash = e.target.checked; scheduleRender(); });
  $('#stampToggle').addEventListener('change', e => { state.optics.stamp = e.target.checked; scheduleRender(); });
  $('#scanToggle').addEventListener('change', e => {
    state.optics.scanlines = e.target.checked ? Math.max(14, state.optics.scanlines) : 0;
    refreshSliderValues(); scheduleRender();
  });
  $('#fxToggle').addEventListener('change', e => { state.fxOff = !e.target.checked; scheduleRender(); });
  $('#autoBtn').addEventListener('click', autoLevel);

  const cmp = $('#compareBtn');
  const hold = (on) => { state.compare = on; scheduleRender(); cmp.classList.toggle('is-active', on); };
  cmp.addEventListener('pointerdown', () => hold(true));
  ['pointerup','pointerleave','pointercancel'].forEach(ev => cmp.addEventListener(ev, () => hold(false)));

  $('#copyBtn').addEventListener('click', async () => {
    if (!state.image) return;
    try {
      const { blob } = await exportBlob();
      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
      toast('Card copied to clipboard');
    } catch(e){ toast('Clipboard not available here'); }
  });

  $('#exportBtn').addEventListener('click', download);
  $('#downloadBtn').addEventListener('click', download);
  $('#resetBtn').addEventListener('click', resetAll);

  wireLayerUI();
  wireLayerDrag();

  window.addEventListener('keydown', e => {
    if ((e.metaKey||e.ctrlKey) && e.key === 's'){ e.preventDefault(); download(); }
    if ((e.metaKey||e.ctrlKey) && e.key === 'o'){ e.preventDefault(); openPicker(); }
    if (e.key === 'Escape' && !fontModal.hidden){ closeFontModal(); return; }
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey && e.target === document.body) surpriseMe();
  });
}

/* quick auto-level from the source pixels */
function autoLevel(){
  if (!state.image) return;
  const w = 160, h = Math.max(1, Math.round(160 * state.image.naturalHeight / state.image.naturalWidth));
  SCRATCH.width = w; SCRATCH.height = h;
  SCTX.setTransform(1,0,0,1,0,0);
  SCTX.clearRect(0,0,w,h);
  SCTX.drawImage(state.image, 0, 0, w, h);
  let data;
  try { data = SCTX.getImageData(0,0,w,h).data; } catch(e){ toast('Auto-level unavailable.'); return; }
  let lo = 255, hi = 0, sum = 0, n = 0;
  for (let i=0;i<data.length;i+=4){
    const l = .2126*data[i] + .7152*data[i+1] + .0722*data[i+2];
    if (l < lo) lo = l; if (l > hi) hi = l;
    sum += l; n++;
  }
  const mean = sum/n, spread = Math.max(1, hi - lo);
  state.tone.contrast = Math.round(clamp((200 - spread)/2.2, -30, 70) * (spread < 150 ? 1 : .3));
  state.tone.exposure = Math.round(clamp((126 - mean)/1.6, -45, 55));
  refreshSliderValues();
  scheduleRender();
  toast('Auto-level applied');
}

/* ---------------------------------------------------------------
   Modes — a shortcut that jumps to a collection and a card
   --------------------------------------------------------------- */
function setMode(mode){
  document.querySelectorAll('.mode').forEach(b => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const map = {
    film:   { coll:'film',     card:'polaroid', aspect:null,  preset:'kodachrome' },
    retro:  { coll:'film',     card:'polaroid', aspect:null,  preset:'kodachrome' },
    digicam:{ coll:'digicam',  card:'digicam',  aspect:null,  preset:'ccd-classic' },
    y2k:    { coll:'y2k',      card:'digicam',  aspect:null,  preset:'y2k-chrome' },
    pano:   { coll:'pano',     card:'pano',     aspect:'3:1', preset:'pano-classic' },
    fx:     { coll:'fx',       card:'none',     aspect:null,  preset:'vhs-tape' },
  }[mode] || { coll:'film', card:'polaroid', aspect:null, preset:'kodachrome' };

  state.collection = map.coll;
  state.search = '';
  $('#searchInput').value = '';
  [...collNav.children].forEach(el => el.classList.toggle('is-active', el.dataset.id === map.coll));
  buildGrid();
  state.card.type = map.card;
  cardPills._sync();
  state.format.aspect = map.aspect || 'auto';
  aspectPills._sync();
  selectPreset(map.preset);
}

/* ---------------------------------------------------------------
   Boot
   --------------------------------------------------------------- */
function init(){
  if (LIB) $('#libCount').textContent = LIB.count + ' looks';
  state.sampleImg = new Image();
  state.sampleImg.onload = () => buildGrid();
  state.sampleImg.src = makeSampleDataURL();

  loadLocal();
  buildCollNav();
  buildOverlayNav();
  buildFontNav();
  buildOverlayGrid();
  renderFontGrid();

  buildPills(cardPills, CARD_TYPES, () => state.card.type, () => {});
  buildPills(aspectPills, ASPECTS, () => state.format.aspect, () => {});
  buildPills(fitPills, [{id:'cover',label:'Fill'},{id:'contain',label:'Fit'}], () => state.format.fit, () => {});
  buildPills(sizePills, SIZES, () => state.size, () => {});
  buildPills(fmtPills, [{id:'png',label:'PNG'},{id:'jpg',label:'JPG'}], () => state.fmt, () => {});
  buildPills(texturePills, TEXTURES, () => state.texture || 'none', () => {});

  state.card.type = 'polaroid';
  state.format.aspect = 'auto';
  wire();
  buildGrid();
  cardPills._sync(); aspectPills._sync(); fitPills._sync(); sizePills._sync(); fmtPills._sync(); texturePills._sync();
  selectPreset('kodachrome');
  syncToggles();
  window.addEventListener('resize', scheduleRender);
}

document.addEventListener('DOMContentLoaded', init);
