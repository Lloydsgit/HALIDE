/* ============================================================
   HALIDE — effects.js
   Procedural image effects. Each effect takes a canvas and a
   params object and returns a new canvas of the same size.
   Registered on window.HALIDE_EFFECTS.
   ============================================================ */
(function(){
  'use strict';

  const C = (v,a,b) => v<a?a:v>b?b:v;
  const L = (r,g,b) => (0.2126*r + 0.7152*g + 0.0722*b);

  function make(w,h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function copy(src){
    const c = make(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
  function blur(src, px){
    const c = make(src.width, src.height);
    const x = c.getContext('2d');
    x.filter = 'blur(' + Math.max(.4, px) + 'px)';
    x.drawImage(src, 0, 0);
    return c;
  }
  function mapPixels(src, fn){
    const c = copy(src);
    const x = c.getContext('2d');
    let id;
    try { id = x.getImageData(0,0,c.width,c.height); } catch(e){ return c; }
    fn(id.data, c.width, c.height);
    x.putImageData(id, 0, 0);
    return c;
  }
  function mix(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  function hex(h){
    h = String(h||'#ffffff').replace('#','');
    if (h.length === 3) h = h.split('').map(c=>c+c).join('');
    const n = parseInt(h, 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
  function rgba(c, a){ return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')'; }
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /* soft radial screen glow */
  function screenGrad(d, w, h, cx, cy, r, color, alpha){
    const g = d.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(.55, rgba(color, alpha*.45));
    g.addColorStop(1, rgba(color, 0));
    d.save();
    d.globalCompositeOperation = 'screen';
    d.fillStyle = g;
    d.fillRect(0,0,w,h);
    d.restore();
  }
  function noiseTile(size, seed){
    const c = make(size, size);
    const x = c.getContext('2d');
    const id = x.createImageData(size, size);
    const rnd = mulberry32(seed||7);
    for (let i=0;i<id.data.length;i+=4){
      const v = rnd()*255;
      id.data[i]=id.data[i+1]=id.data[i+2]=v;
      id.data[i+3]=255;
    }
    x.putImageData(id,0,0);
    return c;
  }

  /* ---------------------------------------------------------------
     PIXEL EFFECTS
     --------------------------------------------------------------- */

  /* map luminance onto a two/three-stop gradient */
  function gradientMap(src, p){
    const stops = (p.stops || ['#101018','#f6e7d0']).map(hex);
    return mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const t = L(d[i],d[i+1],d[i+2]) / 255;
        let c;
        if (stops.length === 2) c = mix(stops[0], stops[1], t);
        else if (stops.length === 3) c = t<.5 ? mix(stops[0],stops[1],t*2) : mix(stops[1],stops[2],(t-.5)*2);
        else {
          const seg = Math.min(stops.length-1, Math.floor(t*(stops.length-1)));
          const lt = t*(stops.length-1) - seg;
          c = mix(stops[seg], stops[Math.min(seg+1,stops.length-1)], lt);
        }
        d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2];
      }
    });
  }
  function duotone(src, p){ return gradientMap(src, { stops:[p.dark||'#12213a', p.light||'#ffd9a0'] }); }
  function tritone(src, p){ return gradientMap(src, { stops:[p.a||'#1b1030', p.b||'#c85a7a', p.c||'#ffe9b0'] }); }

  /* split-tone: push shadows one way, highlights the other */
  function split(src, p){
    const sh = hex(p.shadow || '#1a2a4a');
    const hl = hex(p.high   || '#ffd9a0');
    const amt = p.amount == null ? .5 : p.amount;
    return mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const l = L(d[i],d[i+1],d[i+2]) / 255;
        const t = l<.5 ? (1-l*2) : 0;
        const u = l>.5 ? (l-.5)*2 : 0;
        d[i]   = C(d[i]   + (sh[0]-128)*t*amt + (hl[0]-128)*u*amt, 0, 255);
        d[i+1] = C(d[i+1] + (sh[1]-128)*t*amt + (hl[1]-128)*u*amt, 0, 255);
        d[i+2] = C(d[i+2] + (sh[2]-128)*t*amt + (hl[2]-128)*u*amt, 0, 255);
      }
    });
  }

  function negative(src){ return mapPixels(src, d => { for(let i=0;i<d.length;i+=4){ if(!d[i+3])continue; d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; } }); }

  function solarize(src, p){
    const th = (p.threshold==null?.55:p.threshold)*255;
    return mapPixels(src, d => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const l = L(d[i],d[i+1],d[i+2]);
        if (l > th){ d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; }
      }
    });
  }

  function posterize(src, p){
    const n = Math.max(2, p.levels || 5), step = 255/(n-1);
    return mapPixels(src, d => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        d[i]=Math.round(d[i]/step)*step;
        d[i+1]=Math.round(d[i+1]/step)*step;
        d[i+2]=Math.round(d[i+2]/step)*step;
      }
    });
  }

  function threshold(src, p){
    const th = (p.level==null?.5:p.level)*255;
    return mapPixels(src, d => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const v = L(d[i],d[i+1],d[i+2]) > th ? 255 : 0;
        d[i]=d[i+1]=d[i+2]=v;
      }
    });
  }

  /* ordered (Bayer 4x4) dithering — the classic 1-bit / low-colour look */
  function dither(src, p){
    const BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
    const levels = Math.max(2, p.levels || 2);
    const scale = Math.max(1, Math.round(p.size || 2));
    const c = copy(src);
    const x = c.getContext('2d');
    let id; try { id = x.getImageData(0,0,c.width,c.height); } catch(e){ return c; }
    const d = id.data, W = c.width, H = c.height;
    const step = 255/(levels-1);
    for (let y=0;y<H;y+=scale){
      for (let xx=0;xx<W;xx+=scale){
        const i = (y*W+xx)*4;
        const th = (BAYER[((y/scale)%4)*4 + ((xx/scale)%4)] / 16 - .5) * step;
        for (let k=0;k<scale && y+k<H;k++){
          for (let j=0;j<scale && xx+j<W;j++){
            const q = ((y+k)*W + xx+j)*4;
            if (!d[q+3]) continue;
            d[q]   = C(Math.round((d[q]  +th)/step)*step,0,255);
            d[q+1] = C(Math.round((d[q+1]+th)/step)*step,0,255);
            d[q+2] = C(Math.round((d[q+2]+th)/step)*step,0,255);
          }
        }
      }
    }
    x.putImageData(id,0,0);
    return c;
  }

  /* CMYK-style halftone dots */
  function halftone(src, p){
    const size = Math.max(3, p.size || 6);
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    const tmp = make(w,h);
    const tx = tmp.getContext('2d');
    tx.drawImage(src,0,0);
    let id; try { id = tx.getImageData(0,0,w,h); } catch(e){ return copy(src); }
    const d = id.data;
    x.fillStyle = p.bg || '#f4efe4';
    x.fillRect(0,0,w,h);
    x.fillStyle = p.ink || '#14131a';
    for (let cy=size/2; cy<h; cy+=size){
      for (let cx=size/2; cx<w; cx+=size){
        const i = (Math.floor(cy)*w + Math.floor(cx))*4;
        const l = L(d[i],d[i+1],d[i+2])/255;
        const r = (1-l) * size * .62;
        if (r > .3){
          x.beginPath();
          x.arc(cx, cy, r, 0, Math.PI*2);
          x.fill();
        }
      }
    }
    return c;
  }

  function mosaic(src, p){
    const s = Math.max(2, Math.round(p.size || 10));
    const c = copy(src);
    const x = c.getContext('2d');
    let id; try { id = x.getImageData(0,0,c.width,c.height); } catch(e){ return c; }
    const d = id.data, W = c.width, H = c.height;
    for (let y=0;y<H;y+=s){
      for (let xx=0;xx<W;xx+=s){
        let r=0,g=0,b=0,n=0;
        for (let k=0;k<s && y+k<H;k++) for (let j=0;j<s && xx+j<W;j++){
          const q = ((y+k)*W+xx+j)*4;
          r+=d[q]; g+=d[q+1]; b+=d[q+2]; n++;
        }
        r/=n; g/=n; b/=n;
        for (let k=0;k<s && y+k<H;k++) for (let j=0;j<s && xx+j<W;j++){
          const q = ((y+k)*W+xx+j)*4;
          d[q]=r; d[q+1]=g; d[q+2]=b;
        }
      }
    }
    x.putImageData(id,0,0);
    return c;
  }

  /* pixel sort — smears bright runs along an axis */
  function pixelsort(src, p){
    const amt = p.amount == null ? .5 : p.amount;
    const vertical = p.axis === 'y';
    const th = (p.threshold==null?.5:p.threshold)*255;
    const c = copy(src);
    const x = c.getContext('2d');
    let id; try { id = x.getImageData(0,0,c.width,c.height); } catch(e){ return c; }
    const d = id.data, W = c.width, H = c.height;
    const line = (get, set, len) => {
      let run = [];
      const flush = () => {
        if (run.length > 2){
          run.sort((a,b) => a.v - b.v);
          for (let i=0;i<run.length;i++) set(run[i].i, run[i]);
        }
        run = [];
      };
      for (let i=0;i<len;i++){
        const px = get(i);
        if (px.v > th) run.push(px);
        else flush();
      }
      flush();
    };
    const px = (idx) => {
      const i = idx*4;
      return { i:idx, r:d[i], g:d[i+1], b:d[i+2], a:d[i+3], v:L(d[i],d[i+1],d[i+2]) };
    };
    if (!vertical){
      for (let y=0;y<H;y++){
        line(i => px(y*W+i), (idx,o) => { const q=idx*4; d[q]=o.r; d[q+1]=o.g; d[q+2]=o.b; }, W);
      }
    } else {
      for (let xx=0;xx<W;xx++){
        line(i => px(i*W+xx), (idx,o) => { const q=idx*4; d[q]=o.r; d[q+1]=o.g; d[q+2]=o.b; }, H);
      }
    }
    x.putImageData(id,0,0);
    /* blend sorted version back by amount */
    const out = make(W,H);
    const ox = out.getContext('2d');
    ox.drawImage(src,0,0);
    ox.globalAlpha = amt;
    ox.drawImage(c,0,0);
    return out;
  }

  /* luminance -> thermal camera palette */
  function thermal(src){
    const stops = ['#05010f','#2b0b6b','#8a1f9e','#e83a5a','#ff9a3c','#ffe94a','#ffffff'].map(hex);
    return gradientMap(src, { stops });
  }

  /* risograph: 2-3 flat spot inks multiplied together */
  function riso(src, p){
    const inks = (p.inks || ['#ff4f6e','#2b6cff']).map(hex);
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.fillStyle = p.paper || '#f7f2e6';
    x.fillRect(0,0,w,h);
    const tmp = make(w,h); tmp.getContext('2d').drawImage(src,0,0);
    let id; try { id = tmp.getContext('2d').getImageData(0,0,w,h); } catch(e){ return copy(src); }
    const d = id.data;
    const layer = make(w,h);
    const lx = layer.getContext('2d');
    for (let k=0;k<inks.length;k++){
      const ink = inks[k];
      const off = k*1.2;
      const lid = lx.createImageData(w,h);
      for (let i=0;i<d.length;i+=4){
        const l = L(d[i],d[i+1],d[i+2])/255;
        const v = Math.pow(l, .85);
        const a = (1 - v) * 255;
        lid.data[i]=ink[0]; lid.data[i+1]=ink[1]; lid.data[i+2]=ink[2];
        lid.data[i+3]= a * (k===0?1:.85);
      }
      lx.putImageData(lid,0,0);
      x.globalCompositeOperation = k===0 ? 'multiply' : 'multiply';
      x.globalAlpha = 1;
      x.drawImage(layer, off, off*.5);
    }
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    /* speckle */
    if (p.grain){
      x.globalAlpha = p.grain*.5;
      x.globalCompositeOperation = 'multiply';
      x.drawImage(noiseTile(128, 11), 0,0, w,h);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  /* ---------------------------------------------------------------
     GLITCH / CRT / VHS
     --------------------------------------------------------------- */
  function rgbSplit(src, p){
    const amt = p.amount == null ? 4 : p.amount;
    const c = make(src.width, src.height);
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    const mk = (ch, dx, dy) => {
      const t = make(src.width, src.height);
      const tx = t.getContext('2d');
      tx.drawImage(src, dx, dy);
      tx.globalCompositeOperation = 'multiply';
      tx.fillStyle = ch;
      tx.fillRect(0,0,t.width,t.height);
      return t;
    };
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .85;
    x.drawImage(mk('#ff2b2b', amt, 0), 0, 0);
    x.drawImage(mk('#2bffd6', -amt, 0), 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function glitch(src, p){
    const amt = p.amount == null ? .5 : p.amount;
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed || 42);
    const bands = Math.round(4 + amt*26);
    for (let i=0;i<bands;i++){
      const y = Math.floor(rnd()*h);
      const bh = Math.max(2, Math.floor(rnd()*h*.06));
      const dx = Math.round((rnd()-.5) * w * .12 * amt);
      x.drawImage(src, 0, y, w, bh, dx, y, w, bh);
    }
    /* channel tearing */
    if (amt > .3){
      const s = Math.round(amt*14);
      const t = make(w,h);
      const tx = t.getContext('2d');
      tx.drawImage(src, s, 0);
      tx.globalCompositeOperation = 'multiply';
      tx.fillStyle = '#ff0044';
      tx.fillRect(0,0,w,h);
      x.globalCompositeOperation = 'screen';
      x.globalAlpha = amt*.7;
      x.drawImage(t,0,0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  function scanlines(src, p){
    const step = Math.max(2, Math.round(p.size || 3));
    const amt = p.amount == null ? .4 : p.amount;
    const c = copy(src);
    const x = c.getContext('2d');
    x.globalAlpha = amt;
    x.fillStyle = p.color || '#000';
    for (let y=0; y<src.height; y+=step*2) x.fillRect(0,y,src.width,step);
    x.globalAlpha = amt*.3;
    x.fillStyle = '#7fd8ff';
    for (let xx=0; xx<src.width; xx+=step*2) x.fillRect(xx,0,step,src.height);
    x.globalAlpha = 1;
    return c;
  }

  function crt(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    /* barrel-ish scale + soft edge */
    const k = .965;
    const bw = w*k, bh = h*k;
    x.drawImage(src, (w-bw)/2, (h-bh)/2, bw, bh);
    /* glow */
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .28;
    x.drawImage(blur(src, Math.max(2, w*.008)), 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    /* aperture grille */
    const step = Math.max(2, Math.round(p.size || 3));
    x.globalAlpha = .34; x.fillStyle = '#000';
    for (let y=0;y<h;y+=step*2) x.fillRect(0,y,w,step);
    x.globalAlpha = .16;
    for (let xx=0;xx<w;xx+=step*2){ x.fillStyle='#ff5a5a'; x.fillRect(xx,0,step,h); }
    x.globalAlpha = 1;
    /* screen reflection */
    const g = x.createLinearGradient(0,0,w,h*.6);
    g.addColorStop(0,'rgba(255,255,255,.10)');
    g.addColorStop(.4,'rgba(255,255,255,.02)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0,0,w,h);
    /* corner vignette */
    const vg = x.createRadialGradient(w/2,h/2, Math.min(w,h)*.35, w/2,h/2, Math.max(w,h)*.72);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.62)');
    x.fillStyle = vg; x.fillRect(0,0,w,h);
    return c;
  }

  function vhs(src, p){
    const amt = p.amount == null ? .6 : p.amount;
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    /* chroma bleed */
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .5*amt;
    const t = make(w,h); const tx=t.getContext('2d');
    tx.drawImage(src, 5, 0);
    tx.globalCompositeOperation='multiply'; tx.fillStyle='#ff3b6b'; tx.fillRect(0,0,w,h);
    x.drawImage(t,0,0);
    x.globalCompositeOperation='source-over'; x.globalAlpha=1;
    /* wobble bands */
    const rnd = mulberry32(p.seed||9);
    for (let i=0;i<Math.round(3+amt*10);i++){
      const y = Math.floor(rnd()*h);
      const bh = 2+Math.floor(rnd()*6);
      x.globalAlpha = .5;
      x.drawImage(src, Math.round((rnd()-.5)*10*amt), y, w, bh, 0, y, w, bh);
    }
    x.globalAlpha=1;
    /* tracking noise band */
    const ny = Math.floor(rnd()*h);
    x.globalAlpha = .35*amt;
    x.drawImage(noiseTile(128, 5), 0, ny, w, 24);
    x.globalAlpha = 1;
    /* scanlines */
    x.globalAlpha = .22*amt; x.fillStyle='#000';
    for (let y=0;y<h;y+=4) x.fillRect(0,y,w,2);
    x.globalAlpha=1;
    /* timestamp text */
    if (p.timestamp !== false){
      x.font = Math.max(11, Math.round(w*.03)) + 'px "IBM Plex Mono", monospace';
      x.fillStyle = 'rgba(255,255,255,.86)';
      x.shadowColor='rgba(0,0,0,.8)'; x.shadowBlur=4;
      x.textAlign='left';
      x.fillText('▶ PLAY', w*.04, h*.93);
      x.textAlign='right';
      x.fillText('SP  00:0' + (rnd()*9|0), w*.96, h*.93);
      x.shadowBlur=0;
    }
    return c;
  }

  /* ---------------------------------------------------------------
     LIGHT / GLOW / LEAK
     --------------------------------------------------------------- */
  function bloom(src, p){
    const amt = p.amount == null ? .5 : p.amount;
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.drawImage(src,0,0);
    /* isolate highlights */
    const hl = mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        const l = L(d[i],d[i+1],d[i+2]);
        const k = l>170 ? (l-170)/85 : 0;
        d[i]*=k; d[i+1]*=k; d[i+2]*=k;
      }
    });
    const b = blur(hl, Math.max(3, w*.02));
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = amt;
    x.drawImage(b,0,0);
    x.globalAlpha = amt*.6;
    x.drawImage(blur(hl, Math.max(6, w*.05)),0,0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function softfocus(src, p){
    const amt = p.amount == null ? .45 : p.amount;
    const w = src.width;
    const c = make(src.width, src.height);
    const x = c.getContext('2d');
    x.drawImage(src,0,0);
    x.globalAlpha = amt;
    x.globalCompositeOperation = 'screen';
    x.drawImage(blur(src, Math.max(3, w*.012)),0,0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function lightleak(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const cols = (p.colors || ['#ff7a29','#ffd36b','#ff4d6d']).map(hex);
    const corner = p.corner || 'tl';
    const pos = {
      tl:[0,0], tr:[w,0], bl:[0,h], br:[w,h], left:[0,h*.5], right:[w,h*.5]
    }[corner] || [0,0];
    cols.forEach((col,i) => {
      const r = Math.max(w,h)*(.5 + i*.22);
      screenGrad(x, w, h, pos[0] + (i? w*.08:0), pos[1] + (i? h*.08:0), r, col, (p.amount==null?.55:p.amount)*(1 - i*.22));
    });
    if (p.streak){
      const g = x.createLinearGradient(0,0,w,0);
      g.addColorStop(0, rgba(cols[0], .5));
      g.addColorStop(.5, rgba(cols[1], .12));
      g.addColorStop(1, rgba(cols[0], 0));
      x.globalCompositeOperation='screen';
      x.fillStyle=g; x.fillRect(0,0,w,h);
      x.globalCompositeOperation='source-over';
    }
    return c;
  }

  function bokeh(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed||21);
    const n = Math.round(p.count || 14);
    const col = hex(p.color || '#ffe6b0');
    x.globalCompositeOperation = 'screen';
    for (let i=0;i<n;i++){
      const r = (0.02 + rnd()*0.07) * Math.max(w,h);
      const cx = rnd()*w, cy = rnd()*h;
      const g = x.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0, rgba(col, .5));
      g.addColorStop(.7, rgba(col, .18));
      g.addColorStop(1, rgba(col, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function sparkle(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed||33);
    const n = Math.round(p.count || 40);
    x.globalCompositeOperation = 'screen';
    for (let i=0;i<n;i++){
      const cx = rnd()*w, cy = rnd()*h;
      const s = (0.004 + rnd()*0.012) * Math.max(w,h);
      const g = x.createRadialGradient(cx,cy,0,cx,cy,s);
      g.addColorStop(0,'rgba(255,255,255,.95)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(cx,cy,s,0,Math.PI*2); x.fill();
      /* cross flare */
      x.strokeStyle = 'rgba(255,255,255,.7)';
      x.lineWidth = Math.max(1, s*.18);
      x.beginPath(); x.moveTo(cx-s*1.6,cy); x.lineTo(cx+s*1.6,cy); x.stroke();
      x.beginPath(); x.moveTo(cx,cy-s*1.6); x.lineTo(cx,cy+s*1.6); x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function prism(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.drawImage(src,0,0);
    const bands = [
      ['#ff2d55', -.04], ['#ffd60a', -.013], ['#30d158', .013], ['#0a84ff', .04]
    ];
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = (p.amount==null?.4:p.amount);
    bands.forEach(b => {
      const off = w*b[1];
      const t = make(w,h); const tx = t.getContext('2d');
      tx.drawImage(src, off, 0);
      tx.globalCompositeOperation='multiply'; tx.fillStyle=b[0]; tx.fillRect(0,0,w,h);
      x.drawImage(t,0,0);
    });
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return c;
  }

  function lensflare(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const cx = w*(p.x==null?.7:p.x), cy = h*(p.y==null?.28:p.y);
    const col = hex(p.color || '#ffd9a0');
    x.globalCompositeOperation = 'screen';
    /* core */
    const g = x.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.4);
    g.addColorStop(0, rgba(col,.85));
    g.addColorStop(.12, rgba(col,.35));
    g.addColorStop(1, rgba(col,0));
    x.fillStyle=g; x.fillRect(0,0,w,h);
    /* streak */
    const sg = x.createLinearGradient(0,cy-h*.06,w,cy+h*.06);
    sg.addColorStop(0, rgba(col,0));
    sg.addColorStop(.5, rgba(col,.45));
    sg.addColorStop(1, rgba(col,0));
    x.fillStyle=sg; x.fillRect(0,cy-h*.06,w,h*.12);
    /* ghosts along the axis */
    const dx = w/2 - cx, dy = h/2 - cy;
    [.35,.6,.85,1.2].forEach((t,i) => {
      const gx = cx + dx*t*1.6, gy = cy + dy*t*1.6;
      const r = Math.max(w,h)*(.05 + i*.02);
      const gg = x.createRadialGradient(gx,gy,0,gx,gy,r);
      gg.addColorStop(0, rgba(col,.28));
      gg.addColorStop(.8, rgba(col,.08));
      gg.addColorStop(1, rgba(col,0));
      x.fillStyle=gg; x.beginPath(); x.arc(gx,gy,r,0,Math.PI*2); x.fill();
    });
    x.globalCompositeOperation='source-over';
    return c;
  }

  function gradientoverlay(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const a = hex(p.a || '#ff6b9d'), b = hex(p.b || '#5b8cff');
    const g = x.createLinearGradient(0,0,w,h);
    g.addColorStop(0, rgba(a,1));
    g.addColorStop(1, rgba(b,1));
    x.globalCompositeOperation = p.blend || 'soft-light';
    x.globalAlpha = p.amount==null?.6:p.amount;
    x.fillStyle = g; x.fillRect(0,0,w,h);
    x.globalAlpha=1; x.globalCompositeOperation='source-over';
    return c;
  }

  function colorwash(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    (p.colors || ['#ff2d95','#00e5ff']).forEach((col,i) => {
      const col2 = hex(col);
      const g = x.createLinearGradient(i? w:0, 0, i? 0:w, h);
      g.addColorStop(0, rgba(col2,1));
      g.addColorStop(1, rgba(col2,0));
      x.globalCompositeOperation = 'screen';
      x.globalAlpha = (p.amount==null?.4:p.amount);
      x.fillStyle=g; x.fillRect(0,0,w,h);
    });
    x.globalAlpha=1; x.globalCompositeOperation='source-over';
    return c;
  }

  function neon(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    /* darken base */
    x.drawImage(src,0,0);
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = .72;
    x.fillStyle = '#1a0b2e';
    x.fillRect(0,0,w,h);
    x.globalAlpha = 1;
    /* edge glow */
    const edges = edgesOf(src);
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .9;
    x.filter = 'blur(' + Math.max(2, w*.006) + 'px)';
    x.drawImage(edges,0,0);
    x.filter='none';
    x.globalAlpha = .6;
    const tint = make(w,h); const tx = tint.getContext('2d');
    tx.drawImage(edges,0,0);
    tx.globalCompositeOperation='multiply';
    tx.fillStyle = p.color || '#00f0ff';
    tx.fillRect(0,0,w,h);
    x.drawImage(tint,0,0);
    x.globalAlpha=1; x.globalCompositeOperation='source-over';
    return c;
  }

  function edgesOf(src){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    let id; try { id = x.getImageData(0,0,w,h); } catch(e){ return c; }
    const t = make(w,h); const tx=t.getContext('2d'); tx.drawImage(src,0,0);
    let sd; try { sd = tx.getImageData(0,0,w,h); } catch(e){ return c; }
    const s = sd.data, d = id.data;
    const K = [0,1,0, 1,-4,1, 0,1,0];
    for (let y=1;y<h-1;y++){
      for (let xx=1;xx<w-1;xx++){
        let acc=0;
        for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++){
          const i = ((y+ky)*w + (xx+kx))*4;
          acc += L(s[i],s[i+1],s[i+2]) * K[(ky+1)*3 + (kx+1)];
        }
        const v = C(Math.abs(acc),0,255);
        const q = (y*w+xx)*4;
        d[q]=d[q+1]=d[q+2]=v; d[q+3]=255;
      }
    }
    x.putImageData(id,0,0);
    return c;
  }

  function emboss(src){
    const w = src.width, h = src.height;
    const t = make(w,h); const tx = t.getContext('2d'); tx.drawImage(src,0,0);
    let sd; try { sd = tx.getImageData(0,0,w,h); } catch(e){ return copy(src); }
    const s = sd.data;
    const c = make(w,h); const x = c.getContext('2d');
    const out = x.createImageData(w,h); const d = out.data;
    for (let y=1;y<h-1;y++) for (let xx=1;xx<w-1;xx++){
      const i = ((y-1)*w + (xx-1))*4, j = ((y+1)*w + (xx+1))*4;
      const v = C(128 + (L(s[i],s[i+1],s[i+2]) - L(s[j],s[j+1],s[j+2])), 0, 255);
      const q = (y*w+xx)*4;
      d[q]=d[q+1]=d[q+2]=v; d[q+3]=255;
    }
    x.putImageData(out,0,0);
    return c;
  }

  /* ---------------------------------------------------------------
     TEXTURE / PRINT / ANALOG
     --------------------------------------------------------------- */
  function papergrain(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = (p.amount==null?.5:p.amount);
    x.drawImage(noiseTile(160, p.seed||3), 0,0,w,h);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function grain(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'overlay';
    x.globalAlpha = (p.amount==null?.5:p.amount);
    x.drawImage(noiseTile(220, p.seed||8), 0,0,w,h);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function vignette(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const amt = p.amount == null ? .6 : p.amount;
    const g = x.createRadialGradient(w/2,h/2, Math.min(w,h)*.22, w/2,h/2, Math.max(w,h)*.76);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(.6, rgba(hex(p.color||'#000000'), amt*.22));
    g.addColorStop(1, rgba(hex(p.color||'#000000'), amt));
    x.fillStyle = g; x.fillRect(0,0,w,h);
    return c;
  }

  function vignetteglow(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    screenGrad(x, w, h, w/2, h/2, Math.max(w,h)*.72, hex(p.color||'#ffd9a0'), p.amount==null?.28:p.amount);
    return c;
  }

  function vignettewhite(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const amt = p.amount == null ? .5 : p.amount;
    const g = x.createRadialGradient(w/2,h/2, Math.min(w,h)*.2, w/2,h/2, Math.max(w,h)*.78);
    g.addColorStop(0,'rgba(255,255,255,0)');
    g.addColorStop(1,'rgba(255,255,255,' + amt + ')');
    x.fillStyle = g; x.fillRect(0,0,w,h);
    return c;
  }

  function dust(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed||55);
    const n = Math.round(p.count || 90);
    for (let i=0;i<n;i++){
      const r = (0.001 + rnd()*0.005)*Math.max(w,h);
      x.fillStyle = 'rgba(255,255,255,' + (.25 + rnd()*.5) + ')';
      x.beginPath(); x.arc(rnd()*w, rnd()*h, r, 0, Math.PI*2); x.fill();
      x.fillStyle = 'rgba(20,18,16,' + (.2 + rnd()*.4) + ')';
      x.beginPath(); x.arc(rnd()*w, rnd()*h, r*.8, 0, Math.PI*2); x.fill();
    }
    /* a few hairs */
    x.strokeStyle='rgba(20,18,16,.35)';
    for (let i=0;i<3;i++){
      x.lineWidth = 1+rnd()*1.5;
      x.beginPath();
      let px = rnd()*w, py = rnd()*h;
      x.moveTo(px,py);
      for (let k=0;k<6;k++){ px += (rnd()-.5)*w*.12; py += (rnd()-.5)*h*.12; x.lineTo(px,py); }
      x.stroke();
    }
    return c;
  }

  function scratch(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed||77);
    const n = Math.round(p.count || 6);
    for (let i=0;i<n;i++){
      const px = rnd()*w;
      x.strokeStyle = 'rgba(255,250,240,' + (.15+rnd()*.5) + ')';
      x.lineWidth = .5 + rnd()*1.6;
      x.beginPath();
      x.moveTo(px, 0);
      x.bezierCurveTo(px+(rnd()-.5)*20, h*.33, px+(rnd()-.5)*20, h*.66, px+(rnd()-.5)*30, h);
      x.stroke();
    }
    return c;
  }

  function grunge(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const rnd = mulberry32(p.seed||13);
    const n = Math.round(p.count || 70);
    x.globalCompositeOperation = 'multiply';
    for (let i=0;i<n;i++){
      const r = (0.01 + rnd()*0.06)*Math.max(w,h);
      const cx = rnd()*w, cy = rnd()*h;
      const g = x.createRadialGradient(cx,cy,0,cx,cy,r);
      const v = 120 + rnd()*135;
      g.addColorStop(0,'rgba(' + (v|0) + ',' + (v|0) + ',' + (v|0) + ',.7)');
      g.addColorStop(1,'rgba(' + (v|0) + ',' + (v|0) + ',' + (v|0) + ',0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function crumple(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    /* fake paper creases with a low-frequency shaded noise */
    const t = make(w,h);
    const tx = t.getContext('2d');
    const rnd = mulberry32(p.seed||19);
    const cell = Math.max(12, Math.round(Math.max(w,h)/26));
    for (let y=0;y<h;y+=cell){
      for (let xx=0;xx<w;xx+=cell){
        const v = 150 + rnd()*105;
        tx.fillStyle = 'rgba(' + (v|0) + ',' + (v|0) + ',' + (v|0) + ',1)';
        tx.fillRect(xx,y,cell,cell);
      }
    }
    const soft = blur(t, cell*.7);
    x.globalCompositeOperation = 'overlay';
    x.globalAlpha = (p.amount==null?.5:p.amount);
    x.drawImage(soft,0,0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  function lightbox(src, p){
    /* fake a backlit/scan look: lifted blacks + warm paper tone */
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.fillStyle = p.paper || '#fdf7ea';
    x.fillRect(0,0,w,h);
    x.globalAlpha = .93;
    x.drawImage(src,0,0);
    x.globalAlpha = 1;
    return c;
  }

  /* ---------------------------------------------------------------
     STICKERS / SHAPES / GRAPHIC
     --------------------------------------------------------------- */
  function sticker(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const kind = p.kind || 'star';
    const col = p.color || '#ffffff';
    const cx = w*(p.x==null?.82:p.x), cy = h*(p.y==null?.18:p.y);
    const s = Math.min(w,h)*(p.size==null?.14:p.size);
    x.save();
    x.translate(cx, cy);
    x.rotate((p.rotate||0) * Math.PI/180);
    x.fillStyle = col;
    x.strokeStyle = col;
    if (kind === 'star'){
      x.beginPath();
      for (let i=0;i<10;i++){
        const r = i%2 ? s*.42 : s;
        const a = -Math.PI/2 + i*Math.PI/5;
        const px = Math.cos(a)*r, py = Math.sin(a)*r;
        i ? x.lineTo(px,py) : x.moveTo(px,py);
      }
      x.closePath(); x.fill();
    } else if (kind === 'heart'){
      x.beginPath();
      x.moveTo(0, s*.6);
      x.bezierCurveTo(-s*1.2, -s*.3, -s*.35, -s*1.1, 0, -s*.35);
      x.bezierCurveTo(s*.35, -s*1.1, s*1.2, -s*.3, 0, s*.6);
      x.fill();
    } else if (kind === 'sparkle'){
      x.beginPath();
      x.moveTo(0,-s); x.quadraticCurveTo(s*.14,-s*.14, s,0);
      x.quadraticCurveTo(s*.14,s*.14, 0,s);
      x.quadraticCurveTo(-s*.14,s*.14, -s,0);
      x.quadraticCurveTo(-s*.14,-s*.14, 0,-s);
      x.fill();
    } else if (kind === 'smiley'){
      x.lineWidth = s*.16; x.beginPath(); x.arc(0,0,s*.8,0,Math.PI*2); x.stroke();
      x.beginPath(); x.arc(-s*.28,-s*.18,s*.11,0,Math.PI*2); x.fill();
      x.beginPath(); x.arc(s*.28,-s*.18,s*.11,0,Math.PI*2); x.fill();
      x.beginPath(); x.arc(0,s*.05,s*.42,.25*Math.PI,.75*Math.PI); x.stroke();
    } else if (kind === 'arrow'){
      x.beginPath();
      x.moveTo(-s,-s*.42); x.lineTo(s*.1,-s*.42); x.lineTo(s*.1,-s*.8);
      x.lineTo(s,0); x.lineTo(s*.1,s*.8); x.lineTo(s*.1,s*.42); x.lineTo(-s,s*.42);
      x.closePath(); x.fill();
    } else if (kind === 'flower'){
      for (let i=0;i<6;i++){
        x.save(); x.rotate(i*Math.PI/3);
        x.beginPath(); x.ellipse(0,-s*.5, s*.26, s*.5, 0, 0, Math.PI*2); x.fill();
        x.restore();
      }
      x.fillStyle = p.center || '#ffd60a';
      x.beginPath(); x.arc(0,0,s*.24,0,Math.PI*2); x.fill();
    } else if (kind === 'butterfly'){
      x.beginPath();
      x.ellipse(-s*.42,-s*.16, s*.42, s*.3, -.5, 0, Math.PI*2); x.fill();
      x.beginPath();
      x.ellipse(s*.42,-s*.16, s*.42, s*.3, .5, 0, Math.PI*2); x.fill();
      x.beginPath();
      x.ellipse(-s*.34,s*.4, s*.3, s*.24, .5, 0, Math.PI*2); x.fill();
      x.beginPath();
      x.ellipse(s*.34,s*.4, s*.3, s*.24, -.5, 0, Math.PI*2); x.fill();
    }
    x.restore();
    return c;
  }

  function border(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.drawImage(src,0,0);
    const b = Math.max(2, Math.round(Math.min(w,h)*(p.size==null?.035:p.size)));
    if (p.style === 'inner'){
      x.strokeStyle = p.color || '#ffffff';
      x.lineWidth = b;
      x.strokeRect(b/2, b/2, w-b, h-b);
    } else {
      x.fillStyle = p.color || '#ffffff';
      x.fillRect(0,0,w,b); x.fillRect(0,h-b,w,b);
      x.fillRect(0,0,b,h); x.fillRect(w-b,0,b,h);
    }
    return c;
  }

  function roundmask(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    if (p.bg){
      x.fillStyle = p.bg; x.fillRect(0,0,w,h);
    }
    const r = Math.min(w,h)*(p.radius==null?.5:p.radius);
    x.save();
    x.beginPath(); x.arc(w/2,h/2,r,0,Math.PI*2); x.clip();
    x.drawImage(src,0,0);
    x.restore();
    return c;
  }

  function polka(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const s = Math.max(8, Math.round(Math.min(w,h)*(p.size==null?.06:p.size)));
    x.globalAlpha = p.amount==null?.28:p.amount;
    x.fillStyle = p.color || '#ffffff';
    for (let y=s/2;y<h;y+=s) for (let xx=((y/(s)|0)%2)?s/2:s; xx<w; xx+=s){
      x.beginPath(); x.arc(xx,y,s*.22,0,Math.PI*2); x.fill();
    }
    x.globalAlpha = 1;
    return c;
  }

  function checker(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const s = Math.max(6, Math.round(Math.min(w,h)*(p.size==null?.05:p.size)));
    x.globalAlpha = p.amount==null?.25:p.amount;
    x.fillStyle = p.color || '#000000';
    for (let y=0;y<h;y+=s) for (let xx=0;xx<w;xx+=s){
      if (((xx/s|0)+(y/s|0))%2) x.fillRect(xx,y,s,s);
    }
    x.globalAlpha = 1;
    return c;
  }

  function stripes(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const s = Math.max(6, Math.round(Math.min(w,h)*(p.size==null?.05:p.size)));
    x.globalAlpha = p.amount==null?.3:p.amount;
    x.fillStyle = p.color || '#ffffff';
    x.save();
    x.translate(w/2,h/2);
    x.rotate((p.angle==null?-30:p.angle)*Math.PI/180);
    x.translate(-w,-h);
    for (let xx=0; xx<w*2; xx+=s*2) x.fillRect(xx,0,s,h*2);
    x.restore();
    x.globalAlpha = 1;
    return c;
  }

  function grid(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const s = Math.max(12, Math.round(Math.min(w,h)*(p.size==null?.12:p.size)));
    x.globalAlpha = p.amount==null?.3:p.amount;
    x.strokeStyle = p.color || '#ffffff';
    x.lineWidth = Math.max(1, Math.min(w,h)*.002);
    for (let xx=0;xx<=w;xx+=s){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx,h); x.stroke(); }
    for (let y=0;y<=h;y+=s){ x.beginPath(); x.moveTo(0,y); x.lineTo(w,y); x.stroke(); }
    x.globalAlpha = 1;
    return c;
  }

  function hearts(src, p){ return stickerLayer(src, p, 'heart'); }
  function stars(src, p){ return stickerLayer(src, p, 'star'); }
  function sparkles(src, p){ return stickerLayer(src, p, 'sparkle'); }
  function stickerLayer(src, p, kind){
    const w = src.width, h = src.height;
    const c = copy(src);
    const rnd = mulberry32(p.seed||101);
    const n = Math.round(p.count || 8);
    const col = p.color || '#ffffff';
    const s = Math.min(w,h)*(p.size==null?.045:p.size);
    const x = c.getContext('2d');
    x.fillStyle = col;
    for (let i=0;i<n;i++){
      const cx = rnd()*w, cy = rnd()*h;
      const sc = s*(.6+rnd()*.9);
      x.save(); x.translate(cx,cy); x.rotate((rnd()-.5)*1.2);
      if (kind === 'heart'){
        x.beginPath();
        x.moveTo(0, sc*.6);
        x.bezierCurveTo(-sc*1.2, -sc*.3, -sc*.35, -sc*1.1, 0, -sc*.35);
        x.bezierCurveTo(sc*.35, -sc*1.1, sc*1.2, -sc*.3, 0, sc*.6);
        x.fill();
      } else if (kind === 'star'){
        x.beginPath();
        for (let k=0;k<10;k++){
          const r = k%2 ? sc*.42 : sc;
          const a = -Math.PI/2 + k*Math.PI/5;
          k ? x.lineTo(Math.cos(a)*r, Math.sin(a)*r) : x.moveTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        x.closePath(); x.fill();
      } else {
        x.beginPath();
        x.moveTo(0,-sc); x.quadraticCurveTo(sc*.14,-sc*.14, sc,0);
        x.quadraticCurveTo(sc*.14,sc*.14, 0,sc);
        x.quadraticCurveTo(-sc*.14,sc*.14, -sc,0);
        x.quadraticCurveTo(-sc*.14,-sc*.14, 0,-sc);
        x.fill();
      }
      x.restore();
    }
    return c;
  }

  /* ---------------------------------------------------------------
     MORE LOOKS
     --------------------------------------------------------------- */
  function holographic(src, p){
    const w = src.width, h = src.height;
    const c = copy(src);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,w,h);
    ['#ff9ecd','#ffe08a','#9ef7c9','#8fd6ff','#c9a6ff','#ff9ecd'].forEach((col,i,arr)=>{
      g.addColorStop(i/(arr.length-1), col);
    });
    x.globalCompositeOperation = 'overlay';
    x.globalAlpha = (p.amount==null?.6:p.amount);
    x.fillStyle = g; x.fillRect(0,0,w,h);
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = (p.amount==null?.25:p.amount*.4);
    x.fillStyle = g; x.fillRect(0,0,w,h);
    x.globalAlpha = 1; x.globalCompositeOperation='source-over';
    if (p.sparkle !== false) return sparkle(c, { count: 26, seed: 71 });
    return c;
  }

  function kaleidoscope(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    const q = make(Math.ceil(w/2), Math.ceil(h/2));
    const qx = q.getContext('2d');
    qx.drawImage(src, 0,0, w/2, h/2, 0,0, q.width, q.height);
    const place = (sx, rot) => {
      x.save();
      x.translate(w/2, h/2);
      x.scale(sx, 1);
      x.rotate(rot);
      x.drawImage(q, 0, 0, q.width, q.height);
      x.restore();
    };
    x.save(); x.translate(w/2,h/2); x.drawImage(q,-q.width,-q.height); x.restore();
    x.save(); x.translate(w/2,h/2); x.scale(-1,1); x.drawImage(q,-q.width,-q.height); x.restore();
    x.save(); x.translate(w/2,h/2); x.scale(1,-1); x.drawImage(q,-q.width,-q.height); x.restore();
    x.save(); x.translate(w/2,h/2); x.scale(-1,-1); x.drawImage(q,-q.width,-q.height); x.restore();
    if (p.blend === 'screen'){ x.globalCompositeOperation='screen'; x.globalAlpha=.5; x.drawImage(c,0,0); x.globalAlpha=1; x.globalCompositeOperation='source-over'; }
    return c;
  }

  function mirror(src, p){
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    const vert = p.axis === 'y';
    const half = make(w,h);
    const hx = half.getContext('2d');
    hx.drawImage(src,0,0);
    x.drawImage(src,0,0);
    if (!vert){
      x.save(); x.translate(w,0); x.scale(-1,1); x.drawImage(src, w/2,0, w/2,h, w/2,0, w/2,h); x.restore();
    } else {
      x.save(); x.translate(0,h); x.scale(1,-1); x.drawImage(src, 0,h/2, w,h/2, 0,h/2, w,h/2); x.restore();
    }
    return c;
  }

  function motionblur(src, p){
    const n = Math.max(2, Math.round(p.steps || 10));
    const dist = p.distance == null ? .04 : p.distance;
    const w = src.width, h = src.height;
    const c = make(w,h);
    const x = c.getContext('2d');
    const ang = (p.angle==null?0:p.angle) * Math.PI/180;
    const dx = Math.cos(ang)*w*dist, dy = Math.sin(ang)*h*dist;
    x.globalAlpha = 1/n;
    for (let i=0;i<n;i++){
      const t = (i/(n-1) - .5);
      x.drawImage(src, dx*t, dy*t);
    }
    x.globalAlpha = 1;
    return c;
  }

  function radialblur(src, p){
    const n = Math.max(2, Math.round(p.steps || 14));
    const w = src.width, h = src.height;
    const amt = p.amount == null ? .04 : p.amount;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.globalAlpha = 1/n;
    for (let i=0;i<n;i++){
      const k = 1 + (i/n)*amt;
      x.save();
      x.translate(w/2,h/2); x.scale(k,k); x.translate(-w/2,-h/2);
      x.drawImage(src,0,0);
      x.restore();
    }
    x.globalAlpha = 1;
    return c;
  }

  function lomo(src, p){
    const w = src.width, h = src.height;
    let c = mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const k = p.sat == null ? 1.45 : p.sat;
        const l = L(d[i],d[i+1],d[i+2]);
        d[i]   = C(l + (d[i]-l)*k, 0,255);
        d[i+1] = C(l + (d[i+1]-l)*k, 0,255);
        d[i+2] = C(l + (d[i+2]-l)*k, 0,255);
        d[i]   = C((d[i]-128)*1.12 + 128 + 6, 0,255);
        d[i+1] = C((d[i+1]-128)*1.12 + 128 + 4, 0,255);
        d[i+2] = C((d[i+2]-128)*1.12 + 128 - 4, 0,255);
      }
    });
    c = vignette(c, { amount: p.vig==null?.82:p.vig });
    return c;
  }

  function crosscurve(src, p){
    return mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        let r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
        r = Math.pow(r, .82);
        g = Math.pow(g, 1.0);
        b = Math.pow(b, 1.22);
        d[i]   = C(r*255, 0,255);
        d[i+1] = C(g*255, 0,255);
        d[i+2] = C(b*255, 0,255);
      }
    });
  }

  function blueprint(src, p){
    const w = src.width, h = src.height;
    const e = edgesOf(src);
    const c = make(w,h);
    const x = c.getContext('2d');
    x.fillStyle = p.paper || '#123a6b';
    x.fillRect(0,0,w,h);
    const inv = mapPixels(e, (d) => { for (let i=0;i<d.length;i+=4){ d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; } });
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .9;
    x.drawImage(inv,0,0);
    x.globalAlpha = 1; x.globalCompositeOperation='source-over';
    if (p.grid){
      const s = Math.round(Math.min(w,h)*.08);
      x.globalAlpha = .18; x.strokeStyle='#9fd0ff'; x.lineWidth=1;
      for (let xx=0;xx<=w;xx+=s){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx,h); x.stroke(); }
      for (let y=0;y<=h;y+=s){ x.beginPath(); x.moveTo(0,y); x.lineTo(w,y); x.stroke(); }
      x.globalAlpha = 1;
    }
    return c;
  }

  function comic(src, p){
    let c = posterize(src, { levels: p.levels || 6 });
    c = mapPixels(c, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const k = 1.35;
        const l = L(d[i],d[i+1],d[i+2]);
        d[i]=C(l+(d[i]-l)*k,0,255);
        d[i+1]=C(l+(d[i+1]-l)*k,0,255);
        d[i+2]=C(l+(d[i+2]-l)*k,0,255);
      }
    });
    const e = edgesOf(c);
    const ink = mapPixels(e, (d) => {
      for (let i=0;i<d.length;i+=4){
        const v = d[i] > 40 ? 0 : 255;
        d[i]=d[i+1]=d[i+2]=v;
      }
    });
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = .85;
    x.drawImage(ink,0,0);
    x.globalAlpha = 1; x.globalCompositeOperation='source-over';
    return c;
  }

  function watercolor(src, p){
    const w = src.width;
    let c = blur(src, Math.max(2, w*.004));
    c = posterize(c, { levels: p.levels || 7 });
    c = mapPixels(c, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const k = 1.2;
        const l = L(d[i],d[i+1],d[i+2]);
        d[i]=C(l+(d[i]-l)*k,0,255);
        d[i+1]=C(l+(d[i+1]-l)*k,0,255);
        d[i+2]=C(l+(d[i+2]-l)*k,0,255);
        d[i]=C(d[i]*.94+18,0,255); d[i+1]=C(d[i+1]*.94+16,0,255); d[i+2]=C(d[i+2]*.94+12,0,255);
      }
    });
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = .35;
    x.drawImage(noiseTile(180, 4), 0,0, c.width, c.height);
    x.globalAlpha = 1; x.globalCompositeOperation='source-over';
    return c;
  }

  function oilpaint(src, p){
    let c = mosaic(src, { size: Math.max(3, Math.round(src.width*.006)) });
    c = mapPixels(c, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        const k = 1.5;
        const l = L(d[i],d[i+1],d[i+2]);
        d[i]=C(l+(d[i]-l)*k,0,255);
        d[i+1]=C(l+(d[i+1]-l)*k,0,255);
        d[i+2]=C(l+(d[i+2]-l)*k,0,255);
      }
    });
    c = edgesOf(c);
    const base = mosaic(src, { size: Math.max(3, Math.round(src.width*.006)) });
    const x = base.getContext('2d');
    x.globalCompositeOperation = 'multiply';
    x.globalAlpha = .5;
    x.drawImage(c,0,0);
    x.globalAlpha = 1; x.globalCompositeOperation='source-over';
    return base;
  }

  function sunbleach(src, p){
    const w = src.width, h = src.height;
    let c = mapPixels(src, (d) => {
      for (let i=0;i<d.length;i+=4){
        if (!d[i+3]) continue;
        d[i]   = C(d[i]*.82 + 44, 0, 255);
        d[i+1] = C(d[i+1]*.8 + 40, 0, 255);
        d[i+2] = C(d[i+2]*.76 + 30, 0, 255);
      }
    });
    const x = c.getContext('2d');
    screenGrad(x, w, h, w*.8, h*.15, Math.max(w,h)*.9, hex('#ffd9a0'), p.amount==null?.4:p.amount);
    return c;
  }

  function dotmatrix(src, p){
    const size = Math.max(3, p.size || 5);
    const w = src.width, h = src.height;
    const tmp = make(w,h); const tx = tmp.getContext('2d'); tx.drawImage(src,0,0);
    let id; try { id = tx.getImageData(0,0,w,h); } catch(e){ return copy(src); }
    const d = id.data;
    const c = make(w,h);
    const x = c.getContext('2d');
    x.fillStyle = p.bg || '#0a0a0c';
    x.fillRect(0,0,w,h);
    for (let cy=size/2; cy<h; cy+=size){
      for (let cx=size/2; cx<w; cx+=size){
        const i = (Math.floor(cy)*w + Math.floor(cx))*4;
        const r = d[i], g = d[i+1], b = d[i+2];
        const l = L(r,g,b)/255;
        const rad = Math.max(.4, (l) * size*.5);
        x.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        x.beginPath(); x.arc(cx,cy,rad,0,Math.PI*2); x.fill();
      }
    }
    return c;
  }

  /* ---------------------------------------------------------------
     REGISTRY
     --------------------------------------------------------------- */
  const REG = {
    gradientMap, duotone, tritone, split, negative, solarize, posterize, threshold,
    dither, halftone, dotmatrix, mosaic, pixelsort, thermal, riso, crosscurve,
    rgbSplit, glitch, scanlines, crt, vhs, emboss, neon, blueprint,
    bloom, softfocus, lightleak, bokeh, sparkle, prism, lensflare,
    gradientoverlay, colorwash, holographic, kaleidoscope, mirror,
    motionblur, radialblur, lomo, sunbleach,
    papergrain, grain, vignette, vignetteglow, vignettewhite, dust, scratch,
    grunge, crumple, lightbox, comic, watercolor, oilpaint,
    sticker, border, roundmask, polka, checker, stripes, grid,
    hearts, stars, sparkles,
  };

  window.HALIDE_EFFECTS = REG;

  /* Apply an ordered list of [name, params] to a canvas. Unknown names and
     per-effect errors are swallowed so one bad effect can't kill a render. */
  window.applyEffects = function(cv, list){
    let c = cv;
    if (!list || !list.length) return c;
    for (let i=0;i<list.length;i++){
      const it = list[i];
      const name = Array.isArray(it) ? it[0] : it;
      const prm = Array.isArray(it) ? (it[1] || {}) : {};
      const fn = REG[name];
      if (!fn) continue;
      try { c = fn(c, prm); } catch(e){ /* keep the chain alive */ }
    }
    return c;
  };
})();
