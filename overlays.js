/* ============================================================
   HALIDE — overlays.js
   The overlay library. Every entry draws into a rect in the
   layer's own normalised space (0..1) and is composited by the
   layer engine in app.js.

   window.HALIDE_OVERLAYS = {
     all, cats, get(id), search(q),
     thumb(id, size) -> dataURL
   }

   Each overlay: { id, name, cat, w?, h?, keep?, draw(c, w, h, o) }
     c   canvas 2d context, origin at the overlay's top-left
     w,h pixel size of the overlay box
     o   { seed, accent, t (0..1 time-ish) }
   ============================================================ */
(function(){
  'use strict';

  const LIST = [];
  const seen = {};

  function slug(s){
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  function def(cat, name, draw, extra){
    let id = slug(name);
    if (seen[id]) id = id + '-' + (++seen[id]); else seen[id] = 1;
    const o = Object.assign({ id, name, cat, draw }, extra || {});
    LIST.push(o);
    return o;
  }

  function rr(c, x, y, w, h, r){
    r = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+r, y);
    c.arcTo(x+w, y,   x+w, y+h, r);
    c.arcTo(x+w, y+h, x,   y+h, r);
    c.arcTo(x,   y+h, x,   y,   r);
    c.arcTo(x,   y,   x+w, y,   r);
    c.closePath();
  }

  function rng(seed){
    let a = seed >>> 0 || 1;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ===========================================================
     TAPE & PAPER
     =========================================================== */
  const TAPE = 'Tape & Paper';

  function tapeBase(c, w, h, tint, tear){
    const r = rng(7);
    c.save();
    c.globalAlpha = .82;
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, tint[0]); g.addColorStop(1, tint[1]);
    c.fillStyle = g;
    if (tear){
      const teeth = 14;
      c.beginPath();
      c.moveTo(0, h*.06);
      for (let i=0;i<=teeth;i++) c.lineTo(w*i/teeth, h*.06 + (i%2 ? -h*.05 : h*.01));
      c.lineTo(w, h*.94);
      for (let i=teeth;i>=0;i--) c.lineTo(w*i/teeth, h*.94 + (i%2 ? h*.05 : -h*.01));
      c.closePath(); c.fill();
    } else {
      rr(c, 0, 0, w, h, Math.min(w,h)*.05); c.fill();
    }
    // fibres
    c.globalAlpha = .12;
    for (let i=0;i<26;i++){
      c.strokeStyle = i%2 ? '#fff' : '#000';
      c.lineWidth = Math.max(1, w*.004);
      const x = r()*w, y = r()*h;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r()-.5)*w*.2, y + (r()-.5)*h*.1); c.stroke();
    }
    c.restore();
  }

  def(TAPE, 'Washi Tape', (c,w,h) => tapeBase(c,w,h,['rgba(255,236,180,.92)','rgba(255,205,120,.92)'], false),
    { w:1.4, h:0.28, keep:true });
  def(TAPE, 'Masking Tape', (c,w,h) => tapeBase(c,w,h,['rgba(232,224,204,.94)','rgba(206,194,168,.94)'], true),
    { w:1.5, h:0.3, keep:true });
  def(TAPE, 'Clear Tape', (c,w,h) => {
    c.save(); c.globalAlpha=.42;
    const g = c.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'rgba(255,255,255,.85)'); g.addColorStop(.5,'rgba(220,235,255,.5)');
    g.addColorStop(1,'rgba(255,255,255,.85)');
    c.fillStyle=g; rr(c,0,0,w,h,Math.min(w,h)*.04); c.fill();
    c.globalAlpha=.35; c.strokeStyle='rgba(255,255,255,.9)'; c.lineWidth=Math.max(1,w*.01);
    rr(c, w*.02, h*.12, w*.96, h*.76, 2); c.stroke();
    c.restore();
  }, { w:1.3, h:0.26, keep:true });
  def(TAPE, 'Gaffer Tape', (c,w,h) => tapeBase(c,w,h,['rgba(44,44,48,.95)','rgba(22,22,26,.95)'], false),
    { w:1.4, h:0.3, keep:true });
  def(TAPE, 'Ripped Paper', (c,w,h) => {
    const r = rng(21);
    c.save();
    c.fillStyle='rgba(250,247,240,.97)';
    c.beginPath();
    c.moveTo(0, h*.1);
    for (let i=1;i<=16;i++) c.lineTo(w*i/16, h*.1 + (r()-.5)*h*.09);
    c.lineTo(w, h*.9);
    for (let i=15;i>=0;i--) c.lineTo(w*i/16, h*.9 + (r()-.5)*h*.09);
    c.closePath(); c.fill();
    c.globalAlpha=.16; c.fillStyle='#000';
    for (let i=0;i<40;i++) c.fillRect(r()*w, r()*h, 1, 1);
    c.restore();
  }, { w:1.5, h:0.7, keep:true });
  def(TAPE, 'Corner Mounts', (c,w,h) => {
    const m = Math.min(w,h)*.26;
    c.save();
    c.fillStyle='rgba(40,38,36,.9)';
    c.beginPath(); c.moveTo(0,0); c.lineTo(m,0); c.lineTo(0,m); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w,0); c.lineTo(w-m,0); c.lineTo(w,m); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0,h); c.lineTo(m,h); c.lineTo(0,h-m); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w,h); c.lineTo(w-m,h); c.lineTo(w,h-m); c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true });
  def(TAPE, 'Photo Corners', (c,w,h) => {
    const m = Math.min(w,h)*.22;
    c.save();
    const g = c.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'rgba(232,226,214,.98)'); g.addColorStop(1,'rgba(198,190,176,.98)');
    c.fillStyle=g;
    const corner = (fx,fy) => {
      c.save();
      c.translate(fx ? w : 0, fy ? h : 0);
      c.scale(fx ? -1 : 1, fy ? -1 : 1);
      c.beginPath(); c.moveTo(0,0); c.lineTo(m,0); c.lineTo(0,m); c.closePath(); c.fill();
      c.restore();
    };
    corner(0,0); corner(1,0); corner(0,1); corner(1,1);
    c.restore();
  }, { w:1, h:1, keep:true });
  def(TAPE, 'Stamp Edge', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(255,255,255,.96)';
    const step = w/28, r = step*.32;
    c.beginPath();
    c.moveTo(0,0);
    for (let x=0;x<=w;x+=step) c.arc(x, 0, r, Math.PI, 0, true);
    c.lineTo(w,h);
    for (let x=w;x>=0;x-=step) c.arc(x, h, r, 0, Math.PI, true);
    c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true });
  def(TAPE, 'Kraft Label', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(186,158,116,.96)';
    rr(c,0,0,w,h,Math.min(w,h)*.06); c.fill();
    c.globalAlpha=.2; c.fillStyle='#4a3a22';
    for (let i=0;i<60;i++) c.fillRect(Math.random()*w, Math.random()*h, 1, 1);
    c.globalAlpha=.5; c.strokeStyle='rgba(74,58,34,.7)'; c.lineWidth=Math.max(1,h*.03);
    rr(c, w*.06, h*.18, w*.88, h*.64, 3); c.stroke();
    c.restore();
  }, { w:1.1, h:0.5, keep:true });

  /* ===========================================================
     LIGHT — leaks, flares, bokeh, glows
     =========================================================== */
  const LIGHT = 'Light';

  def(LIGHT, 'Light Leak', (c,w,h) => {
    const r = rng(3);
    c.save();
    c.globalCompositeOperation='screen';
    for (let i=0;i<5;i++){
      const g = c.createRadialGradient(w*(.1+r()*.8), h*(.1+r()*.8), 0,
                                       w*(.1+r()*.8), h*(.1+r()*.8), Math.max(w,h)*(.3+r()*.6));
      const hue = [12, 30, 320, 350, 45][i%5];
      g.addColorStop(0, `hsla(${hue},95%,62%,.5)`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      c.fillStyle=g; c.fillRect(0,0,w,h);
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Sun Flare', (c,w,h) => {
    c.save();
    c.globalCompositeOperation='screen';
    const cx=w*.78, cy=h*.22;
    const g=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.7);
    g.addColorStop(0,'rgba(255,248,220,.95)');
    g.addColorStop(.12,'rgba(255,220,150,.55)');
    g.addColorStop(.4,'rgba(255,170,90,.18)');
    g.addColorStop(1,'rgba(255,140,60,0)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    // streak
    c.globalAlpha=.3; c.strokeStyle='rgba(255,235,190,.9)'; c.lineWidth=Math.max(2,h*.02);
    c.beginPath(); c.moveTo(0,cy); c.lineTo(w,cy); c.stroke();
    // ghosts
    for (let i=1;i<=4;i++){
      const t=i/5, gx=cx+(w*.5-cx)*t*1.6, gy=cy+(h*.5-cy)*t*1.6;
      c.globalAlpha=.14;
      c.fillStyle=['#ffd27a','#7ad0ff','#ff9ec4','#b6ff9e'][i%4];
      c.beginPath(); c.arc(gx,gy,Math.max(w,h)*.05*(1-t*.4),0,Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Prism Streak', (c,w,h) => {
    const r = rng(11);
    c.save(); c.globalCompositeOperation='screen'; c.globalAlpha=.5;
    for (let i=0;i<3;i++){
      const x = w*(.2+r()*.6);
      const g = c.createLinearGradient(x,0,x+w*.3,h);
      g.addColorStop(0,'rgba(255,120,120,0)');
      g.addColorStop(.5,['rgba(255,140,140,.8)','rgba(140,220,255,.8)','rgba(190,255,150,.8)'][i]);
      g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g;
      c.save(); c.translate(w/2,h/2); c.rotate((i-1)*.5); c.translate(-w/2,-h/2);
      c.fillRect(0,0,w,h); c.restore();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Bokeh', (c,w,h) => {
    const r = rng(5);
    c.save(); c.globalCompositeOperation='screen';
    for (let i=0;i<16;i++){
      const rad = Math.max(w,h)*(.03+r()*.08);
      const x=r()*w, y=r()*h;
      const g=c.createRadialGradient(x,y,0,x,y,rad);
      const hue=[40,200,320,10][i%4];
      g.addColorStop(0,`hsla(${hue},90%,75%,.45)`);
      g.addColorStop(.7,`hsla(${hue},90%,70%,.12)`);
      g.addColorStop(1,'hsla(0,0%,0%,0)');
      c.fillStyle=g; c.beginPath(); c.arc(x,y,rad,0,Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Sparkle Dust', (c,w,h) => {
    const r = rng(9);
    c.save(); c.globalCompositeOperation='screen';
    for (let i=0;i<70;i++){
      const x=r()*w, y=r()*h, s=Math.max(w,h)*(.002+r()*.006);
      c.fillStyle='rgba(255,255,255,'+(.4+r()*.6)+')';
      c.beginPath(); c.arc(x,y,s,0,Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Glow Wash', (c,w,h) => {
    c.save(); c.globalCompositeOperation='screen';
    const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)*.75);
    g.addColorStop(0,'rgba(255,240,210,.5)');
    g.addColorStop(.6,'rgba(255,200,140,.15)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Rainbow Haze', (c,w,h) => {
    c.save(); c.globalCompositeOperation='overlay';
    const g=c.createLinearGradient(0,0,w,h);
    ['rgba(255,0,80,.22)','rgba(255,180,0,.2)','rgba(0,220,140,.2)',
     'rgba(0,140,255,.22)','rgba(180,0,255,.2)'].forEach((col,i,a)=>g.addColorStop(i/(a.length-1),col));
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Neon Glow', (c,w,h) => {
    c.save(); c.globalCompositeOperation='screen';
    const cx=w*.5, cy=h*.5;
    const g=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.6);
    g.addColorStop(0,'rgba(255,60,220,.55)');
    g.addColorStop(.5,'rgba(60,160,255,.22)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Flash Burst', (c,w,h) => {
    c.save(); c.globalCompositeOperation='screen';
    const cx=w*.5, cy=h*.28;
    const g=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.9);
    g.addColorStop(0,'rgba(255,255,255,.85)');
    g.addColorStop(.25,'rgba(255,250,235,.3)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(LIGHT, 'Chrome Sweep', (c,w,h) => {
    c.save(); c.globalCompositeOperation='overlay'; c.globalAlpha=.55;
    const g=c.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'rgba(255,255,255,.6)');
    g.addColorStop(.35,'rgba(160,200,255,.35)');
    g.addColorStop(.5,'rgba(255,255,255,.75)');
    g.addColorStop(.65,'rgba(255,180,220,.35)');
    g.addColorStop(1,'rgba(255,255,255,.6)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  /* ===========================================================
     GRADIENTS
     =========================================================== */
  const GRAD = 'Gradients';

  function gradDef(name, stops, blend, alpha){
    def(GRAD, name, (c,w,h) => {
      c.save();
      c.globalCompositeOperation = blend || 'overlay';
      c.globalAlpha = alpha == null ? .85 : alpha;
      const g = c.createLinearGradient(0,0,w,h);
      stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1), s));
      c.fillStyle=g; c.fillRect(0,0,w,h);
      c.restore();
    }, { w:1, h:1, keep:true });
  }

  gradDef('Sunset Gradient', ['rgba(255,94,120,.7)','rgba(255,180,80,.6)','rgba(120,60,200,.6)']);
  gradDef('Ocean Gradient', ['rgba(20,180,200,.6)','rgba(30,90,220,.6)']);
  gradDef('Candy Gradient', ['rgba(255,150,220,.65)','rgba(150,200,255,.6)']);
  gradDef('Mint Gradient', ['rgba(120,255,200,.55)','rgba(60,180,255,.5)']);
  gradDef('Ember Gradient', ['rgba(255,80,20,.6)','rgba(120,10,40,.65)']);
  gradDef('Violet Gradient', ['rgba(140,60,255,.6)','rgba(255,80,200,.5)']);
  gradDef('Mono Fade', ['rgba(255,255,255,.35)','rgba(0,0,0,.45)'], 'soft-light');
  gradDef('Golden Hour', ['rgba(255,200,90,.55)','rgba(255,120,40,.5)'], 'screen');
  gradDef('Teal & Orange', ['rgba(0,150,160,.5)','rgba(255,140,40,.5)'], 'overlay');
  gradDef('Fade to Black', ['rgba(0,0,0,0)','rgba(0,0,0,.8)'], 'source-over', 1);
  gradDef('Fade to White', ['rgba(255,255,255,0)','rgba(255,255,255,.85)'], 'source-over', 1);
  def(GRAD, 'Duotone Split', (c,w,h) => {
    c.save(); c.globalCompositeOperation='overlay';
    const g=c.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(255,80,140,.6)');
    g.addColorStop(.5,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,160,255,.6)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  /* ===========================================================
     STICKERS & DOODLES
     =========================================================== */
  const STICK = 'Stickers';

  function star(c, x, y, r, pts, inner){
    c.beginPath();
    for (let i=0;i<pts*2;i++){
      const rad = i%2 ? r*(inner||.45) : r;
      const a = (i/(pts*2))*Math.PI*2 - Math.PI/2;
      const px = x + Math.cos(a)*rad, py = y + Math.sin(a)*rad;
      i ? c.lineTo(px,py) : c.moveTo(px,py);
    }
    c.closePath();
  }

  def(STICK, 'Star Sticker', (c,w,h) => {
    c.save();
    const s = Math.min(w,h)*.5;
    c.fillStyle='#ffd93b'; c.strokeStyle='#fff'; c.lineWidth=s*.14;
    star(c, w/2, h/2, s*.42, 5, .45); c.fill(); c.stroke();
    c.restore();
  }, { w:.3, h:.3, keep:true });

  def(STICK, 'Heart Sticker', (c,w,h) => {
    c.save();
    const s = Math.min(w,h);
    c.fillStyle='#ff5a8a'; c.strokeStyle='#fff'; c.lineWidth=s*.09;
    c.beginPath();
    c.moveTo(w/2, h*.82);
    c.bezierCurveTo(w*.05, h*.5, w*.18, h*.12, w/2, h*.34);
    c.bezierCurveTo(w*.82, h*.12, w*.95, h*.5, w/2, h*.82);
    c.closePath(); c.fill(); c.stroke();
    c.restore();
  }, { w:.28, h:.28, keep:true });

  def(STICK, 'Smiley Sticker', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='#ffd93b'; c.strokeStyle='#2a2a2a'; c.lineWidth=s*.07;
    c.beginPath(); c.arc(w/2,h/2,s*.42,0,Math.PI*2); c.fill(); c.stroke();
    c.fillStyle='#2a2a2a';
    c.beginPath(); c.arc(w*.38,h*.42,s*.06,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(w*.62,h*.42,s*.06,0,Math.PI*2); c.fill();
    c.beginPath(); c.arc(w/2,h*.5,s*.24,.2*Math.PI,.8*Math.PI); c.stroke();
    c.restore();
  }, { w:.28, h:.28, keep:true });

  def(STICK, 'Arrow Doodle', (c,w,h) => {
    c.save();
    c.strokeStyle='#fff'; c.lineWidth=Math.min(w,h)*.09; c.lineCap='round'; c.lineJoin='round';
    c.beginPath(); c.moveTo(w*.15,h*.8); c.quadraticCurveTo(w*.5,h*.9,w*.8,h*.3); c.stroke();
    c.beginPath(); c.moveTo(w*.62,h*.28); c.lineTo(w*.82,h*.26); c.lineTo(w*.8,h*.5); c.stroke();
    c.restore();
  }, { w:.4, h:.3, keep:true });

  def(STICK, 'Circle Scribble', (c,w,h) => {
    c.save();
    c.strokeStyle='#ff4d6d'; c.lineWidth=Math.min(w,h)*.07; c.lineCap='round';
    c.beginPath();
    const r=Math.min(w,h)*.38;
    for (let i=0;i<=40;i++){
      const a=(i/40)*Math.PI*2*1.02;
      const rr2=r*(1+Math.sin(i*.7)*.04);
      const x=w/2+Math.cos(a)*rr2, y=h/2+Math.sin(a)*rr2*.82;
      i?c.lineTo(x,y):c.moveTo(x,y);
    }
    c.stroke();
    c.restore();
  }, { w:.42, h:.34, keep:true });

  def(STICK, 'Underline Swash', (c,w,h) => {
    c.save();
    c.strokeStyle='#ffd93b'; c.lineWidth=Math.min(w,h)*.14; c.lineCap='round';
    c.beginPath(); c.moveTo(w*.05,h*.5); c.quadraticCurveTo(w*.5,h*.85,w*.95,h*.4); c.stroke();
    c.restore();
  }, { w:.5, h:.12, keep:true });

  def(STICK, 'Speech Bubble', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='rgba(255,255,255,.96)'; c.strokeStyle='#2a2a2a'; c.lineWidth=s*.05;
    rr(c, 0, 0, w, h*.72, s*.18); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(w*.22,h*.7); c.lineTo(w*.3,h*.98); c.lineTo(w*.44,h*.7); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }, { w:.4, h:.32, keep:true });

  def(STICK, 'Dotted Border', (c,w,h) => {
    c.save();
    c.strokeStyle='#fff'; c.lineWidth=Math.min(w,h)*.02;
    c.setLineDash([Math.min(w,h)*.04, Math.min(w,h)*.03]);
    rr(c, w*.02, h*.02, w*.96, h*.96, Math.min(w,h)*.03); c.stroke();
    c.restore();
  }, { w:.6, h:.6, keep:true });

  def(STICK, 'Sticker Outline', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(255,255,255,.92)';
    rr(c, w*.03, h*.03, w*.94, h*.94, Math.min(w,h)*.12); c.fill();
    c.restore();
  }, { w:.5, h:.5, keep:true });

  def(STICK, 'Sparkle Star', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    const s=Math.min(w,h);
    star(c, w/2, h/2, s*.5, 4, .18); c.fill();
    c.restore();
  }, { w:.22, h:.22, keep:true });

  def(STICK, 'Cross Marks', (c,w,h) => {
    const r=rng(31);
    c.save(); c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=Math.min(w,h)*.03; c.lineCap='round';
    for (let i=0;i<6;i++){
      const x=r()*w, y=r()*h, s=Math.min(w,h)*(.04+r()*.05);
      c.beginPath(); c.moveTo(x-s,y-s); c.lineTo(x+s,y+s);
      c.moveTo(x+s,y-s); c.lineTo(x-s,y+s); c.stroke();
    }
    c.restore();
  }, { w:.5, h:.5, keep:true });

  def(STICK, 'Film Markers', (c,w,h) => {
    const r=rng(17);
    c.save();
    c.fillStyle='rgba(255,120,60,.85)';
    for (let i=0;i<7;i++){
      c.beginPath(); c.arc(r()*w, r()*h, Math.min(w,h)*.02, 0, Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:.6, h:.6, keep:true });

  def(STICK, 'Number Badge', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='#ff7a29';
    c.beginPath(); c.arc(w/2,h/2,s*.44,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.font='700 '+(s*.5)+'px system-ui, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('01', w/2, h/2+s*.02);
    c.restore();
  }, { w:.24, h:.24, keep:true });

  def(STICK, 'NEW Badge', (c,w,h) => {
    c.save();
    c.fillStyle='#ff2d55';
    rr(c,0,0,w,h,Math.min(w,h)*.18); c.fill();
    c.fillStyle='#fff'; c.font='800 '+(Math.min(w,h)*.42)+'px system-ui, sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('NEW', w/2, h/2);
    c.restore();
  }, { w:.3, h:.14, keep:true });

  /* ===========================================================
     FRAMES & BORDERS
     =========================================================== */
  const FRAME = 'Frames';

  function borderDef(name, color, inset, lw){
    def(FRAME, name, (c,w,h) => {
      c.save();
      c.strokeStyle = color;
      c.lineWidth = Math.min(w,h) * (lw || .02);
      const m = c.lineWidth*2;
      c.strokeRect(inset*w + m, inset*h + m, w - inset*w*2 - m*2, h - inset*h*2 - m*2);
      c.restore();
    }, { w:1, h:1, keep:true });
  }

  borderDef('White Border', 'rgba(255,255,255,.95)', .02, .025);
  borderDef('Black Border', 'rgba(0,0,0,.9)', .02, .025);
  borderDef('Gold Border', 'rgba(212,175,55,.95)', .025, .02);
  borderDef('Double Border', 'rgba(255,255,255,.9)', .03, .012);

  def(FRAME, 'Double Line Frame', (c,w,h) => {
    c.save(); c.strokeStyle='rgba(255,255,255,.9)';
    const lw=Math.min(w,h)*.012; c.lineWidth=lw;
    c.strokeRect(w*.03,h*.03,w*.94,h*.94);
    c.lineWidth=lw*.6;
    c.strokeRect(w*.055,h*.055,w*.89,h*.89);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(FRAME, 'Film Sprockets', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(12,12,12,.95)';
    c.fillRect(0,0,w,h*.08); c.fillRect(0,h*.92,w,h*.08);
    c.fillStyle='rgba(255,255,255,.85)';
    const n=Math.max(6, Math.round(w/h*8));
    const pw=w/(n*2), ph=h*.045;
    for (let i=0;i<n;i++){
      rr(c, i*2*pw+pw*.5, h*.02, pw, ph, ph*.25); c.fill();
      rr(c, i*2*pw+pw*.5, h*.955, pw, ph, ph*.25); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(FRAME, 'Polaroid Frame', (c,w,h) => {
    c.save();
    c.strokeStyle='rgba(255,255,255,.9)';
    c.lineWidth=Math.min(w,h)*.06;
    c.strokeRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(FRAME, 'Rounded Mask', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    rr(c,0,0,w,h,Math.min(w,h)*.09); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  def(FRAME, 'Circle Mask', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    c.beginPath(); c.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  def(FRAME, 'Arch Mask', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    c.beginPath();
    c.moveTo(0,h); c.lineTo(0,w/2); c.arc(w/2,w/2,w/2,Math.PI,0); c.lineTo(w,h);
    c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  def(FRAME, 'Torn Edge Mask', (c,w,h) => {
    const r=rng(41);
    c.save();
    c.fillStyle='#fff';
    c.beginPath();
    c.moveTo(0,h*.03);
    for (let i=1;i<=24;i++) c.lineTo(w*i/24, h*.03 + (r()-.5)*h*.05);
    c.lineTo(w,h*.97);
    for (let i=23;i>=0;i--) c.lineTo(w*i/24, h*.97 + (r()-.5)*h*.05);
    c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  /* ===========================================================
     TEXTURES
     =========================================================== */
  const TEX = 'Textures';

  def(TEX, 'Paper Grain', (c,w,h) => {
    const r=rng(51);
    c.save();
    c.globalAlpha=.3;
    for (let i=0;i<Math.min(9000, w*h/22);i++){
      c.fillStyle = r()>.5 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)';
      c.fillRect(r()*w, r()*h, 1, 1);
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Dust & Scratches', (c,w,h) => {
    const r=rng(61);
    c.save();
    c.globalAlpha=.5;
    for (let i=0;i<40;i++){
      c.strokeStyle='rgba(255,255,255,.5)'; c.lineWidth=1;
      const x=r()*w;
      c.beginPath(); c.moveTo(x, r()*h); c.lineTo(x + (r()-.5)*4, r()*h); c.stroke();
    }
    for (let i=0;i<90;i++){
      c.fillStyle='rgba(255,255,255,.6)';
      c.beginPath(); c.arc(r()*w, r()*h, r()*1.6, 0, Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Scanlines', (c,w,h) => {
    c.save();
    c.globalAlpha=.35; c.fillStyle='#000';
    for (let y=0;y<h;y+=3) c.fillRect(0,y,w,1);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Halftone Dots', (c,w,h) => {
    c.save();
    c.globalAlpha=.3; c.fillStyle='#000';
    const step=Math.max(4, Math.min(w,h)/45);
    for (let y=0;y<h;y+=step)
      for (let x=0;x<w;x+=step){
        c.beginPath(); c.arc(x,y,step*.22,0,Math.PI*2); c.fill();
      }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Noise Static', (c,w,h) => {
    const r=rng(71);
    c.save();
    c.globalAlpha=.18;
    for (let i=0;i<Math.min(16000, w*h/14);i++){
      const v = (r()*255)|0;
      c.fillStyle=`rgb(${v},${v},${v})`;
      c.fillRect(r()*w, r()*h, 1, 1);
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Vignette Heavy', (c,w,h) => {
    c.save();
    const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.72);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,.72)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Grid Paper', (c,w,h) => {
    c.save();
    c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=1;
    const step=Math.max(8, Math.min(w,h)/24);
    for (let x=0;x<=w;x+=step){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
    for (let y=0;y<=h;y+=step){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Light Rays', (c,w,h) => {
    const r=rng(81);
    c.save(); c.globalCompositeOperation='screen'; c.globalAlpha=.22;
    for (let i=0;i<10;i++){
      const x=r()*w, bw=w*(.02+r()*.06);
      const g=c.createLinearGradient(x,0,x+bw,h);
      g.addColorStop(0,'rgba(255,250,220,0)');
      g.addColorStop(.5,'rgba(255,245,200,.8)');
      g.addColorStop(1,'rgba(255,250,220,0)');
      c.fillStyle=g;
      c.save(); c.translate(w/2,0); c.rotate((r()-.5)*.6); c.translate(-w/2,0);
      c.fillRect(x,0,bw,h); c.restore();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Splatter', (c,w,h) => {
    const r=rng(91);
    c.save(); c.fillStyle='rgba(255,255,255,.55)';
    for (let i=0;i<70;i++){
      const rad=Math.min(w,h)*(.004+r()*.02);
      c.beginPath(); c.arc(r()*w, r()*h, rad, 0, Math.PI*2); c.fill();
    }
    c.restore();
  }, { w:1, h:1, keep:true });

  def(TEX, 'Canvas Weave', (c,w,h) => {
    c.save(); c.globalAlpha=.16;
    c.strokeStyle='#000'; c.lineWidth=1;
    for (let y=0;y<h;y+=4){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
    c.strokeStyle='#fff';
    for (let x=0;x<w;x+=4){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
    c.restore();
  }, { w:1, h:1, keep:true });

  /* ===========================================================
     RETRO & DIGICAM UI
     =========================================================== */
  const UI = 'Retro UI';

  def(UI, 'Date Stamp', (c,w,h) => {
    c.save();
    c.font = '700 ' + (h*.32) + 'px "IBM Plex Mono", monospace';
    c.fillStyle='rgba(255,140,40,.95)';
    c.shadowColor='rgba(255,120,20,.9)'; c.shadowBlur=h*.18;
    c.textAlign='right'; c.textBaseline='bottom';
    const d=new Date();
    const stamp = d.getFullYear()+' '+String(d.getMonth()+1).padStart(2,'0')+' '
                + String(d.getDate()).padStart(2,'0');
    c.fillText(stamp, w*.96, h*.96);
    c.restore();
  }, { w:.5, h:.1, keep:true });

  def(UI, 'Recording Dot', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='#ff2d2d';
    c.shadowColor='#ff2d2d'; c.shadowBlur=s*.5;
    c.beginPath(); c.arc(w/2,h/2,s*.3,0,Math.PI*2); c.fill();
    c.restore();
  }, { w:.12, h:.12, keep:true });

  def(UI, 'REC Label', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='#ff2d2d';
    c.beginPath(); c.arc(s*.22, h/2, s*.14, 0, Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.font='700 '+(h*.5)+'px "IBM Plex Mono", monospace';
    c.textAlign='left'; c.textBaseline='middle';
    c.fillText('REC', s*.42, h/2);
    c.restore();
  }, { w:.28, h:.12, keep:true });

  def(UI, 'Battery Icon', (c,w,h) => {
    c.save();
    c.strokeStyle='#fff'; c.lineWidth=Math.min(w,h)*.1;
    rr(c, 0, h*.2, w*.86, h*.6, h*.12); c.stroke();
    c.fillStyle='#fff'; c.fillRect(w*.88, h*.38, w*.1, h*.24);
    c.fillStyle='#fff'; rr(c, w*.06, h*.32, w*.4, h*.36, h*.06); c.fill();
    c.restore();
  }, { w:.24, h:.12, keep:true });

  def(UI, 'LCD Counter', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(0,0,0,.7)'; rr(c,0,0,w,h,h*.2); c.fill();
    c.fillStyle='#7dffb0'; c.font='700 '+(h*.5)+'px "IBM Plex Mono", monospace';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('ISO 400', w/2, h/2);
    c.restore();
  }, { w:.3, h:.12, keep:true });

  def(UI, 'View Finder', (c,w,h) => {
    c.save();
    c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=Math.min(w,h)*.012;
    const m=Math.min(w,h)*.06, L=Math.min(w,h)*.16;
    const corner=(x,y,fx,fy)=>{
      c.beginPath();
      c.moveTo(x+fx*L, y); c.lineTo(x,y); c.lineTo(x, y+fy*L); c.stroke();
    };
    corner(m,m,1,1); corner(w-m,m,-1,1); corner(m,h-m,1,-1); corner(w-m,h-m,-1,-1);
    c.beginPath(); c.moveTo(w/2-14,h/2); c.lineTo(w/2+14,h/2);
    c.moveTo(w/2,h/2-14); c.lineTo(w/2,h/2+14); c.stroke();
    c.restore();
  }, { w:.6, h:.6, keep:true });

  def(UI, 'Focus Brackets', (c,w,h) => {
    c.save();
    c.strokeStyle='#7dffb0'; c.lineWidth=Math.min(w,h)*.03;
    const s=Math.min(w,h)*.4;
    c.strokeRect(w/2-s/2, h/2-s/2, s, s);
    c.restore();
  }, { w:.3, h:.3, keep:true });

  def(UI, 'Timestamp Bar', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(0,0,0,.55)'; c.fillRect(0,0,w,h);
    c.fillStyle='#fff'; c.font='600 '+(h*.45)+'px "IBM Plex Mono", monospace';
    c.textAlign='center'; c.textBaseline='middle';
    const d=new Date();
    c.fillText(d.toISOString().slice(0,10).replace(/-/g,'.'), w/2, h/2);
    c.restore();
  }, { w:.34, h:.1, keep:true });

  def(UI, 'Play Button', (c,w,h) => {
    c.save();
    const s=Math.min(w,h);
    c.fillStyle='rgba(0,0,0,.5)'; c.beginPath(); c.arc(w/2,h/2,s*.48,0,Math.PI*2); c.fill();
    c.fillStyle='#fff';
    c.beginPath(); c.moveTo(w*.4,h*.32); c.lineTo(w*.72,h*.5); c.lineTo(w*.4,h*.68); c.closePath(); c.fill();
    c.restore();
  }, { w:.2, h:.2, keep:true });

  def(UI, 'Tape Counter', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(18,18,18,.85)'; rr(c,0,0,w,h,h*.16); c.fill();
    c.fillStyle='#ff5a5a'; c.font='700 '+(h*.42)+'px "IBM Plex Mono", monospace';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText('00:04:12', w/2, h/2);
    c.restore();
  }, { w:.34, h:.12, keep:true });

  def(UI, 'Crop Marks', (c,w,h) => {
    c.save();
    c.strokeStyle='rgba(255,255,255,.9)'; c.lineWidth=Math.max(1,Math.min(w,h)*.008);
    const L=Math.min(w,h)*.08;
    const mark=(x,y,fx,fy)=>{
      c.beginPath(); c.moveTo(x,y+fy*L); c.lineTo(x,y); c.lineTo(x+fx*L,y); c.stroke();
    };
    mark(0,0,1,1); mark(w,0,-1,1); mark(0,h,1,-1); mark(w,h,-1,-1);
    c.restore();
  }, { w:.7, h:.7, keep:true });

  def(UI, 'Corner Ticks', (c,w,h) => {
    c.save();
    c.strokeStyle='rgba(255,255,255,.8)'; c.lineWidth=Math.max(1,Math.min(w,h)*.01);
    const L=Math.min(w,h)*.06;
    [[0,0,1,1],[w,0,-1,1],[0,h,1,-1],[w,h,-1,-1]].forEach(([x,y,fx,fy])=>{
      c.beginPath(); c.moveTo(x+fx*L,y); c.lineTo(x,y); c.lineTo(x,y+fy*L); c.stroke();
    });
    c.restore();
  }, { w:.7, h:.7, keep:true });

  def(UI, 'Loading Bar', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(0,0,0,.5)'; rr(c,0,0,w,h,h/2); c.fill();
    c.fillStyle='#7dffb0'; rr(c,h*.15,h*.15,(w-h*.3)*.62,h*.7,h*.35); c.fill();
    c.restore();
  }, { w:.4, h:.1, keep:true });

  /* ===========================================================
     SHAPES & MASKS
     =========================================================== */
  const SHAPE = 'Shapes';

  def(SHAPE, 'Solid Colour', (c,w,h) => {
    c.save(); c.fillStyle='rgba(255,122,41,.35)'; c.fillRect(0,0,w,h); c.restore();
  }, { w:1, h:1, keep:true });

  def(SHAPE, 'Dark Vignette Box', (c,w,h) => {
    c.save();
    const g=c.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'rgba(0,0,0,.6)'); g.addColorStop(.4,'rgba(0,0,0,0)');
    g.addColorStop(.6,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.6)');
    c.fillStyle=g; c.fillRect(0,0,w,h);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(SHAPE, 'Letterbox Bars', (c,w,h) => {
    c.save(); c.fillStyle='rgba(0,0,0,.92)';
    c.fillRect(0,0,w,h*.11); c.fillRect(0,h*.89,w,h*.11);
    c.restore();
  }, { w:1, h:1, keep:true });

  def(SHAPE, 'Pill Blur', (c,w,h) => {
    c.save();
    c.filter='blur('+(Math.min(w,h)*.06)+'px)';
    c.fillStyle='rgba(255,255,255,.12)';
    rr(c,0,0,w,h,Math.min(w,h)/2); c.fill();
    c.restore();
  }, { w:.4, h:.2, keep:true });

  def(SHAPE, 'Circle Blob', (c,w,h) => {
    c.save();
    c.fillStyle='rgba(255,122,41,.35)';
    c.beginPath(); c.ellipse(w/2,h/2,w*.42,h*.42,0,0,Math.PI*2); c.fill();
    c.restore();
  }, { w:.4, h:.4, keep:true });

  def(SHAPE, 'Torn Paper Mask', (c,w,h) => {
    const r=rng(101);
    c.save();
    c.fillStyle='#fff';
    c.beginPath(); c.moveTo(0,0); c.lineTo(w,0);
    c.lineTo(w, h*.92);
    for (let i=20;i>=0;i--) c.lineTo(w*i/20, h*.92 + (r()-.5)*h*.08);
    c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  def(SHAPE, 'Blob Mask', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    c.beginPath();
    for (let i=0;i<=60;i++){
      const a=(i/60)*Math.PI*2;
      const rad=(.42 + Math.sin(a*3)*.05 + Math.cos(a*5)*.03) * Math.min(w,h);
      const x=w/2+Math.cos(a)*rad, y=h/2+Math.sin(a)*rad;
      i?c.lineTo(x,y):c.moveTo(x,y);
    }
    c.closePath(); c.fill();
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  def(SHAPE, 'Stripe Mask', (c,w,h) => {
    c.save();
    c.fillStyle='#fff';
    const bw=w/9;
    for (let i=0;i<9;i+=2) c.fillRect(i*bw,0,bw,h);
    c.restore();
  }, { w:1, h:1, keep:true, mask:true });

  /* ===========================================================
     Registry
     =========================================================== */
  const CAT_ORDER = [TAPE, LIGHT, GRAD, STICK, FRAME, TEX, UI, SHAPE];
  const CATS = CAT_ORDER.map(name => ({
    name, id: slug(name),
    count: LIST.filter(o => o.cat === name).length,
  })).filter(c => c.count);

  const BY_ID = {};
  for (const o of LIST) BY_ID[o.id] = o;

  function get(id){ return BY_ID[id] || null; }

  function search(q){
    q = String(q || '').trim().toLowerCase();
    if (!q) return LIST;
    return LIST.filter(o =>
      o.name.toLowerCase().includes(q) || o.cat.toLowerCase().includes(q));
  }

  /* Render a small preview thumbnail as a data URL. */
  function thumb(id, size){
    const o = get(id);
    if (!o) return '';
    const cv = document.createElement('canvas');
    cv.width = cv.height = size || 64;
    const c = cv.getContext('2d');
    c.clearRect(0,0,cv.width,cv.height);
    // a checker so transparent overlays are visible
    const s = size || 64, cell = Math.max(4, s/8);
    for (let y=0;y<s;y+=cell) for (let x=0;x<s;x+=cell){
      c.fillStyle = ((x/cell + y/cell) % 2) ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)';
      c.fillRect(x,y,cell,cell);
    }
    const pad = s*0.08;
    const bw = s - pad*2, bh = s - pad*2;
    const box = (o.keep || true) ? { w: bw, h: bh } : { w: bw, h: bh };
    c.save();
    c.translate(pad, pad);
    try { o.draw(c, box.w, box.h, { seed: 1, accent: '#ff7a29' }); } catch(e){}
    c.restore();
    return cv.toDataURL();
  }

  window.HALIDE_OVERLAYS = {
    all: LIST, count: LIST.length, cats: CATS,
    get, search, thumb,
  };
})();
