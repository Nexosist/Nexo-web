/* NEXO · visor 3D de obras en seco
 * - Carga Three.js solo cuando la escena está por verse.
 * - Ajusta la calidad al equipo (alta, media, baja) y dibuja solo cuando algo cambia.
 * - Si no hay WebGL o el equipo va muy lento, deja los dibujos vectoriales que ya están en la página.
 */
(function () {
  'use strict';

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var THREE_SRI = 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';

  var instances = [];
  var threePromise = null;

  // ---------------------------------------------------------------- capacidad del equipo
  var gpuCache = null;
  function gpuName() {
    if (gpuCache !== null) return gpuCache;
    gpuCache = '';
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpuCache = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { gpuCache = ''; }
    return gpuCache;
  }

  function capability() {
    var mem = navigator.deviceMemory || 4;
    var cores = navigator.hardwareConcurrency || 4;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var small = Math.min(window.screen.width, window.screen.height) < 700;
    var q = /[?&]gl=(low|mid|high|off)/.exec(window.location.search);
    var gpu = gpuName();
    var tier = 'mid';                                   // por defecto, calidad media: sin reflejos pesados
    var software = /swiftshader|llvmpipe|software|basic render|softpipe/i.test(gpu);
    if (mem <= 2 || cores <= 2) tier = 'low';
    else if (/nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m\d|apple gpu/i.test(gpu) && !coarse && !small && cores >= 4) tier = 'high';
    else if (/adreno|mali|powervr/i.test(gpu) && mem <= 3) tier = 'low';
    var off = false;
    if (q) {
      if (q[1] === 'off') off = true; else tier = q[1];     // para probar a mano: ?gl=low, ?gl=mid, ?gl=high, ?gl=off
    } else if (software) {
      off = true;                                        // dibujo por software: el 3D va lento, se quedan los dibujos 2D
    }
    return { tier: tier, off: off, gpu: gpu, reduce: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches };
  }

  var webglCache = null;
  function webglOk() {
    if (webglCache !== null) return webglCache;
    try {
      var c = document.createElement('canvas');
      webglCache = !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { webglCache = false; }
    return webglCache;
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = THREE_URL;
      s.integrity = THREE_SRI;
      s.crossOrigin = 'anonymous';
      s.async = true;
      s.onload = function () { window.THREE ? resolve(window.THREE) : reject(new Error('three')); };
      s.onerror = function () { threePromise = null; reject(new Error('carga')); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  // ---------------------------------------------------------------- materiales y texturas
  function makeEnv(THREE, tier, mode) {
    var std = mode !== 'lite';
    var texCache = {};

    var S = tier === 'high' ? 4 : 2;         // píxeles de textura por unidad: el doble o el cuádruple según el equipo
    var cvCache = {};
    function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

    function drawTex(kind) {
      if (cvCache[kind]) return cvCache[kind];
      var n = 128, c = document.createElement('canvas');
      c.width = c.height = n * S;
      var g = c.getContext('2d');
      g.scale(S, S);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, n, n);
      var i, v;
      // dibuja la forma también corrida un lado, para que la textura repita sin costuras
      function each(f) {
        for (var dx = -n; dx <= n; dx += n) for (var dy = -n; dy <= n; dy += n) { g.save(); g.translate(dx, dy); f(); g.restore(); }
      }
      if (kind === 'paper') {
        // papel de la placa: grano fino y manchas muy suaves
        for (i = 0; i < 1400; i++) {
          v = 255 - Math.floor(Math.random() * 12);
          g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
          g.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
        for (i = 0; i < 26; i++) {
          (function (x, y, r, a) {
            each(function () {
              var gr = g.createRadialGradient(x, y, 0, x, y, r);
              gr.addColorStop(0, 'rgba(120,115,100,' + a + ')'); gr.addColorStop(1, 'rgba(120,115,100,0)');
              g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
            });
          })(rnd(0, n), rnd(0, n), rnd(14, 34), rnd(0.012, 0.03));
        }
      } else if (kind === 'concrete') {
        for (i = 0; i < 2600; i++) {
          v = 255 - Math.floor(Math.random() * 38);
          g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
          g.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
      } else if (kind === 'galv') {
        // chapa galvanizada: cristales de zinc de distinto brillo y el moleteado fino a lo largo del perfil
        for (i = 0; i < 90; i++) {
          (function (x, y, r, sides, rot, val) {
            each(function () {
              g.beginPath();
              for (var k = 0; k < sides; k++) {
                var an = rot + k * Math.PI * 2 / sides, rr = r * (0.75 + 0.25 * ((k * 7 + sides) % 3) / 2);
                if (k) g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); else g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
              }
              g.closePath();
              g.fillStyle = 'rgb(' + val + ',' + val + ',' + (val + 3) + ')';
              g.fill();
              g.strokeStyle = 'rgba(70,75,80,0.16)'; g.lineWidth = 0.35; g.stroke();
            });
          })(rnd(0, n), rnd(0, n), rnd(6, 15), 5 + Math.floor(Math.random() * 3), rnd(0, 6.28), 218 + Math.floor(Math.random() * 37));
        }
        g.fillStyle = 'rgba(0,0,0,0.09)';
        for (i = 0; i < n; i += 2) g.fillRect(0, i, n, 0.6);
      } else if (kind === 'stucco') {
        for (i = 0; i < 3200; i++) {
          v = 255 - Math.floor(Math.random() * 11);
          g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
          g.fillRect(Math.random() * n, Math.random() * n, 1, 1);
        }
      } else if (kind === 'fiber') {
        // lana de vidrio: manchas suaves de espesor y fibras muy cortas en todas direcciones
        for (i = 0; i < 120; i++) {
          (function (x, y, r, dark) {
            each(function () {
              var gr = g.createRadialGradient(x, y, 0, x, y, r), c0 = dark ? '120,95,30' : '255,250,225';
              gr.addColorStop(0, 'rgba(' + c0 + ',0.12)'); gr.addColorStop(1, 'rgba(' + c0 + ',0)');
              g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
            });
          })(rnd(0, n), rnd(0, n), rnd(4, 13), Math.random() < 0.55);
        }
        for (i = 0; i < 1500; i++) {
          (function (x, y, a, l, dark) {
            each(function () {
              g.strokeStyle = dark ? 'rgba(125,100,40,0.20)' : 'rgba(255,248,215,0.30)';
              g.lineWidth = 0.45;
              g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
            });
          })(rnd(0, n), rnd(0, n), rnd(0, 6.28), rnd(2, 7), Math.random() < 0.5);
        }
      } else if (kind === 'osb') {
        for (i = 0; i < 160; i++) {
          v = 200 + Math.floor(Math.random() * 55);
          g.fillStyle = 'rgb(' + v + ',' + (v - 8) + ',' + (v - 30) + ')';
          g.fillRect(Math.random() * n, Math.random() * n, 8 + Math.random() * 22, 3 + Math.random() * 5);
        }
      } else if (kind === 'rib') {
        for (i = 0; i < n; i += 16) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(i, 0, 3, n);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(i + 3, 0, 2, n);
        }
      }
      cvCache[kind] = c;
      return c;
    }

    function finishTex(t) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = tier === 'high' ? 8 : tier === 'mid' ? 4 : 1;
      return t;
    }
    function canvasTex(kind) {
      if (texCache[kind]) return texCache[kind];
      var t = finishTex(new THREE.CanvasTexture(drawTex(kind)));
      t.encoding = THREE.sRGBEncoding;                 // la imagen está en sRGB; la luz se calcula en lineal
      texCache[kind] = t;
      return t;
    }
    // la misma imagen sirve de relieve fino (sin cambiar de color)
    function bumpTex(kind) {
      var key = 'b_' + kind;
      if (!texCache[key]) texCache[key] = finishTex(new THREE.CanvasTexture(drawTex(kind)));
      return texCache[key];
    }
    function lin(hex) { var c = new THREE.Color(hex); c.convertSRGBToLinear(); return c; }

    // texturas reales (ambientCG, licencia CC0), livianas: se piden una vez y se aplican cuando llegan
    var env = { mk: null, std: std, tier: tier, tex: canvasTex, lin: lin, onTex: null, paperMapReal: null };
    var realCache = {};
    function whenTex(file, srgb, cb) {
      var e = realCache[file];
      if (!e) {
        e = realCache[file] = { cbs: [], tex: null };
        var loader = new THREE.TextureLoader();
        e.tex = loader.load('assets/tex/' + file, function () {
          var q = e.cbs; e.cbs = null;
          q.forEach(function (f) { f(e.tex); });
          if (env.onTex) env.onTex();
        }, undefined, function () { e.failed = true; });
        e.tex.wrapS = e.tex.wrapT = THREE.RepeatWrapping;
        e.tex.anisotropy = tier === 'high' ? 8 : 4;
        if (srgb) e.tex.encoding = THREE.sRGBEncoding;
      }
      if (e.cbs) e.cbs.push(cb); else if (!e.failed) cb(e.tex);
    }
    function useReal(mat, r) {
      whenTex(r.c, true, function (t) {
        mat.map = t; mat.color.copy(lin(r.tint)); mat.bumpMap = null;
        if (mat.userData.map0 !== undefined) mat.userData.map0 = t;
        mat.needsUpdate = true;
      });
      whenTex(r.n, false, function (t) {
        mat.normalMap = t; mat.normalScale = new THREE.Vector2(r.ns, r.ns); mat.needsUpdate = true;
      });
      if (r.o) whenTex(r.o, false, function (t) {
        mat.roughnessMap = t; mat.metalnessMap = t; mat.roughness = 1.0; mat.metalness = 1.0; mat.needsUpdate = true;
      });
    }

    var defs = {
      steel:    { color: 0xc4c9ce, metalness: 0.92, roughness: 0.36, lam: 0xaeb4ba, tex: 'galv', bump: 0.9, real: { c: 'steel-c.webp', n: 'steel-n.webp', o: 'steel-orm.webp', tint: 0xf0f2f4, ns: 0.4 } },
      screw:    { color: 0x3d3f42, metalness: 0.6, roughness: 0.45, lam: 0x3d3f42 },
      board:    { color: 0xe9e8e2, roughness: 0.9, tex: 'paper', bump: 0.6, real: { c: 'paper-c.webp', n: 'paper-n.webp', tint: 0xdbd9d2, ns: 0.12 } },
      boardRaw: { color: 0xc3c1b8, roughness: 0.92, tex: 'paper', bump: 0.6, real: { c: 'paper-c.webp', n: 'paper-n.webp', tint: 0xb3b1a8, ns: 0.12 } },
      ins:      { color: 0xdcc88e, roughness: 1, tex: 'fiber', bump: 1.6, real: { c: 'wool-c.webp', n: 'wool-n.webp', tint: 0xffdd88, ns: 1.0 } },
      conduit:  { color: 0xf08a24, roughness: 0.5 },
      pipe:     { color: 0x4f86d6, roughness: 0.45 },
      slab:     { color: 0x8c8f92, roughness: 0.97, tex: 'concrete', bump: 1.0, real: { c: 'slab-c.webp', n: 'slab-n.webp', tint: 0xd2d2d2, ns: 0.5 } },
      masonry:  { color: 0xbab2a4, roughness: 0.98, tex: 'stucco', real: { c: 'slab-c.webp', n: 'slab-n.webp', tint: 0xe8d6bc, ns: 0.5 } },
      tile:     { color: 0xa9a49b, roughness: 0.5, real: { c: 'tile-c.webp', n: 'tile-n.webp', tint: 0xdedede, ns: 0.4 } },
      osb:      { color: 0xcaa56d, roughness: 0.92, tex: 'osb', real: { c: 'osb-c.webp', n: 'osb-n.webp', tint: 0xfdf0e4, ns: 0.4 } },
      roof:     { color: 0x6b7176, metalness: 0.55, roughness: 0.45, tex: 'rib', lam: 0x6b7176, real: { c: 'steel-c.webp', n: 'steel-n.webp', o: 'steel-orm.webp', tint: 0x59606a, ns: 0.3 } },
      glass:    { color: 0x37526e, metalness: 0.15, roughness: 0.1 },
      frame:    { color: 0xf4f4f2, roughness: 0.6 },
      wood:     { color: 0x7b5a3a, roughness: 0.7 },
      counter:  { color: 0x9a7a58, roughness: 0.62 },
      lamp:     { color: 0xfff3c4, emissive: 0xfff3c4, roughness: 0.4 },
      mark:     { color: 0xff5a67, roughness: 0.6, emissive: 0x551018 },
      paint:    { color: 0xeee6d3, roughness: 0.9, tex: 'paper', bump: 0.4, real: { c: 'paper-c.webp', n: 'paper-n.webp', tint: 0xe2dac7, ns: 0.1 } },
      sheet:    { color: 0xc8cbcf, roughness: 0.8 }
    };

    function mk(kind) {
      var d = defs[kind];
      var opts = { color: lin(std ? d.color : (d.lam || d.color)) };
      if (d.tex) opts.map = canvasTex(d.tex);
      if (d.emissive) opts.emissive = lin(d.emissive);
      if (std) {
        opts.roughness = d.roughness;
        opts.metalness = d.metalness || 0;
        opts.envMapIntensity = d.metalness ? 1.15 : 0.55;
        if (d.bump && tier !== 'low') { opts.bumpMap = bumpTex(d.tex); opts.bumpScale = d.bump; }
        var sm = new THREE.MeshStandardMaterial(opts);
        if (d.real && tier !== 'low') useReal(sm, d.real);
        return sm;
      }
      return new THREE.MeshLambertMaterial(opts);
    }
    env.mk = mk;
    if (std && tier !== 'low') whenTex('paper-c.webp', true, function (t) { env.paperMapReal = t; });
    return env;
  }

  // Estudio de luz suave: cielo claro arriba, piso gris y tres pantallas de luz, para que el acero y el papel tengan algo que reflejar
  function makeEnvMap(THREE, renderer) {
    var pm = new THREE.PMREMGenerator(renderer);
    var sc = new THREE.Scene();
    var cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    var g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#9fb4cc'); grad.addColorStop(0.42, '#dfe6ee'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(0.52, '#7c8187'); grad.addColorStop(1, '#3c4046');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    var ct = new THREE.CanvasTexture(cv);
    ct.encoding = THREE.sRGBEncoding;
    var sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: ct, side: THREE.BackSide }));
    sc.add(sky);
    [[-30, 26, 30, 34, 14, 0xfff4e6], [34, 18, 20, 30, 12, 0xeaf1ff], [0, 40, -36, 40, 10, 0xffffff]].forEach(function (p) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), new THREE.MeshBasicMaterial({ color: p[5], side: THREE.DoubleSide }));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); sc.add(m);
    });
    var tex = pm.fromScene(sc, 0.04).texture;
    pm.dispose();
    return tex;
  }

  // ---------------------------------------------------------------- geometría
  function merge(THREE, geos) {
    var parts = geos.map(function (g) { return g.index ? g.toNonIndexed() : g; });
    var n = 0;
    parts.forEach(function (g) { n += g.attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), o = 0;
    parts.forEach(function (g) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }

  function boxGeo(THREE, w, h, d, x, y, z) {
    var g = new THREE.BoxGeometry(w, h, d);
    g.translate(x || 0, y || 0, z || 0);
    return g;
  }

  // Montante: alma con perforaciones de servicio, alas y rebordes (perfil C), apoyado en y = 0
  // Perfil de referencia (Durlock): montante 69 con alas de 35 y 30 mm, sin rebordes, y alma con perforaciones
  function studGeometryD(THREE, h, web) {
    var t = 0.22, D = web || 6.9, FA = 3.5, FB = 3.0;
    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(D, 0); shape.lineTo(D, h); shape.lineTo(0, h); shape.closePath();
    for (var y = 32.5; D > 5 && y < h - 8; y += 65) {
      var p = new THREE.Path();
      p.absellipse(D / 2, y, 1.2, 2.0, 0, Math.PI * 2, true, 0);
      shape.holes.push(p);
    }
    var web = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 10 });
    web.rotateY(Math.PI / 2);
    web.translate(-t / 2, 0, D / 2);
    return merge(THREE, [web,
      boxGeo(THREE, FA, h, t, FA / 2 - t / 2, h / 2, D / 2 - t / 2),
      boxGeo(THREE, FB, h, t, FB / 2 - t / 2, h / 2, -(D / 2 - t / 2))]);
  }
  function studGeometry(THREE, h, prof, web) {
    if (prof === 'durlock') return studGeometryD(THREE, h, web);
    var t = 0.22, D = 7, F = 3.5, L = 1;
    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(D, 0); shape.lineTo(D, h); shape.lineTo(0, h); shape.closePath();
    for (var y = 22; y < h - 10; y += 40) {
      var p = new THREE.Path();
      p.absellipse(D / 2, y, 1.6, 2.6, 0, Math.PI * 2, true, 0);
      shape.holes.push(p);
    }
    var web = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 8 });
    web.rotateY(Math.PI / 2);          // espesor -> x, ancho -> -z
    web.translate(-t / 2, 0, D / 2);
    var parts = [web];
    [1, -1].forEach(function (s) {
      parts.push(boxGeo(THREE, F, h, t, F / 2 - t / 2, h / 2, s * (D / 2 - t / 2)));
      parts.push(boxGeo(THREE, t, h, L, F - t * 1.5, h / 2, s * (D / 2 - t - L / 2)));
    });
    return merge(THREE, parts);
  }

  // Omega: alas de 19, cuerpo trapezoidal de 13 de alto y 32 de ancho arriba, de largo len a lo largo de z
  function omegaGeometry(THREE, len) {
    var t = 0.22;
    return merge(THREE, [
      boxGeo(THREE, 1.9, t, len, -2.55, t / 2, 0), boxGeo(THREE, 1.9, t, len, 2.55, t / 2, 0),
      boxGeo(THREE, t, 1.3, len, -1.6, 0.65, 0), boxGeo(THREE, t, 1.3, len, 1.6, 0.65, 0),
      boxGeo(THREE, 3.2 + t, t, len, 0, 1.3 - t / 2, 0)]);
  }
  // Placa de yeso de ancho w (en x), alto h (en y) y espesor th (en z): sus bordes largos (arriba y abajo) llevan el rebaje
  // (el manual de Durlock: "bordes longitudinales con rebaje"). Centrada en el origen.
  function plateGeometry(THREE, w, h, th) {
    var rb = 0.1, rw = Math.min(4, h / 3), s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0, h); s.lineTo(th - rb, h); s.lineTo(th, h - rw); s.lineTo(th, rw); s.lineTo(th - rb, 0); s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2, -h / 2, -th / 2);
    var uv = g.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 90, uv.getY(i) / 90);
    return g;
  }
  // Solera (perfil U) de largo len, apoyada en y = 0 con el alma hacia abajo
  function trackGeometry(THREE, len, prof) {
    var t = 0.22, D = prof === 'durlock' ? 7.0 : 7.4, Fh = 3;
    return merge(THREE, [
      boxGeo(THREE, len, t, D, len / 2, t / 2, 0),
      boxGeo(THREE, len, Fh, t, len / 2, Fh / 2, D / 2 - t / 2),
      boxGeo(THREE, len, Fh, t, len / 2, Fh / 2, -(D / 2 - t / 2))
    ]);
  }

  // ---------------------------------------------------------------- nombres de las piezas (para el cartel al tocar o pasar el mouse)
  var LABELS = {
    solera: ['Solera', 'Perfil en U que se fija al piso y a la losa y guía a los montantes. Medida de referencia: alma de 70 mm y alas de 30 mm, en barras de 2,60 m (Durlock y Knauf).'],
    montante: ['Montante', 'Perfil en C vertical que forma el esqueleto de la pared. Las perforaciones del alma dejan pasar cables y cañerías. Medida de referencia: alma de 69 mm y alas de 35 y 30 mm, en barras de 2,60 m (Durlock).'],
    'montante-abertura': ['Montantes de abertura', 'Montantes dobles a los lados de puertas y ventanas: apoyan el dintel y refuerzan el borde del hueco.'],
    dintel: ['Dintel', 'Viga sobre el hueco de puertas y ventanas. Lleva a los montantes de los costados lo que hay encima.'],
    'montante-corto': ['Montante corto', 'Completa el tramo entre el dintel y la solera superior, y entre la solera del antepecho y la inferior.'],
    antepecho: ['Solera de antepecho', 'Cierra por abajo el hueco de la ventana y apoya los montantes cortos.'],
    cinta: ['Cinta de rigidización', 'Fleje de acero en diagonal que le da rigidez al panel frente al viento y al sismo.'],
    anclaje: ['Anclaje', 'Escuadra de acero abulonada a la fundación y atornillada al montante: evita que el panel se levante o se desplace.'],
    ins: ['Aislación', 'Lana de vidrio o de roca entre los perfiles, para la aislación térmica y acústica.'],
    inst: ['Instalaciones', 'Cables y cañerías que pasan por las perforaciones de los montantes, antes de cerrar el último lado con placas.'],
    board: ['Placa de yeso', 'Se atornilla a los perfiles. Hay placas estándar, resistentes a la humedad y resistentes al fuego. Medida de referencia: 1,20 m de ancho, 2,40 m de largo y 12,5 mm de espesor, con bordes largos rebajados (Durlock y Knauf).'],
    tornillo: ['Tornillo', 'Fija la placa al perfil. El tornillo para placas tiene cabeza trompeta (los T2, T3 y T4 de Durlock).'],
    junta: ['Junta tomada', 'Cinta de papel de 50 mm y masilla sobre la unión entre placas, para que la superficie quede continua.'],
    masilla: ['Masilla', 'Cubre la cabeza de los tornillos para que la superficie quede lisa y lista para pintar.'],
    zocalo: ['Zócalo', 'Moldura que remata la pared al pie.'],
    cornisa: ['Cornisa', 'Moldura que remata el encuentro entre la pared y el cielorraso.'],
    osb: ['Placa de OSB', 'Tablero de virutas de madera orientadas que se usa como cerramiento exterior.'],
    platea: ['Platea', 'Fundación de hormigón armado en forma de losa, que reparte la carga de la construcción sobre el suelo.'],
    armadura: ['Armadura', 'Barras de acero que trabajan junto con el hormigón de la platea.'],
    entrepiso: ['Entrepiso', 'Piso de la planta nueva, armado sobre la construcción existente.'],
    exist: ['Construcción existente', 'La obra sobre la que se apoya o se arma lo nuevo.'],
    cabio: ['Cabio', 'Perfil inclinado de acero que forma la estructura del techo.'],
    roof: ['Cubierta', 'Cierra el techo y evita el paso del agua.'],
    'techo-losa': ['Techo', 'Cierra la planta nueva por arriba.'],
    cumbrera: ['Cumbrera', 'Remata el encuentro de las dos aguas del techo.'],
    ventana: ['Ventana', 'Abertura con su marco, colocada en el hueco que dejó la estructura.'],
    puerta: ['Puerta', 'Hoja y marco colocados en el hueco armado en la pared o en el tabique.'],
    esquinero: ['Esquinero', 'Remata la esquina exterior de la pared.'],
    losa: ['Losa o techo', 'Estructura de hormigón de la que cuelga el cielorraso.'],
    'cinta-sellado': ['Cinta de sellado acústica', 'Tira que va entre la solera y el piso o la losa.'],
    muro: ['Muro', 'Pared contra la que termina el cielorraso. Entre la placa y el muro se deja una separación.'],
    angulo: ['Ángulo perimetral', 'Es opcional: se fija a la pared y sirve de guía de nivel. No se le fija ninguna parte de la estructura ni las placas.'],
    'tornillo-perfil': ['Tornillo de estructura', 'Une un perfil con otro en el empalme solapado.'],
    varilla: ['Cuelga', 'Cuelga la estructura del cielorraso del techo. Puede ser una varilla, un perfil (en el sistema de Durlock, la vela rígida, un montante de 34 mm cada 1,00 m), una guaya o un alambre galvanizado.'],
    'perfil-cielo': ['Perfil del cielorraso', 'Perfiles de acero que reciben las placas del cielorraso.'],
    'perfil-carga': ['Perfil que carga el cielorraso', 'Se fija a las cuelgas y sostiene al resto de la estructura. Se muestra con la forma del montante de 34 mm (Durlock).'],
    'perfil-placa': ['Perfil donde se atornilla la placa', 'Perfil omega: va en sentido perpendicular a los que cargan, y a él se atornillan las placas. Medida de referencia: 70 mm de ancho y 13 mm de alto (Durlock).'],
    'placa-cielo': ['Placa de cielorraso', 'Placa de yeso atornillada a los perfiles, trabada con las vecinas y con una separación contra los muros; por encima queda un espacio para las instalaciones. Medida de referencia: placa de 7 mm de espesor y 1,20 x 2,40 m para perfiles cada 60 cm (Durlock CIEL).'],
    mark: ['Replanteo', 'Marca sobre el piso de dónde va cada tabique.']
  };
  var KIND_KEY = { board: 'board', boardRaw: 'board', osb: 'osb', ins: 'ins', conduit: 'inst', pipe: 'inst', roof: 'roof', mark: 'mark', masonry: 'exist' };
  function tagk(obj, k) { obj.userData.k = k; return obj; }

  // ---------------------------------------------------------------- modelo
  function Builder(THREE, env) {
    this.T = THREE;
    this.env = env;
    this.root = new THREE.Group();
    this.layers = [];
    this.studCache = {};
    this.prof = null;
  }
  Builder.prototype.layer = function (from, off, hi) {
    var T = this.T;
    var L = { g: new T.Group(), from: from, hi: hi === undefined ? from : hi, off: off || new T.Vector3(0, 0, 0), p: from === 0 ? 1 : 0, target: from === 0 ? 1 : 0, mats: [] };
    this.root.add(L.g);
    this.layers.push(L);
    return L;
  };
  Builder.prototype.nm = function (L, name) { L.name = name; return L; };
  Builder.prototype.mat = function (L, kind) {
    var m = this.env.mk(kind);
    m.name = kind;
    L.mats.push(m);
    return m;
  };
  Builder.prototype.box = function (L, kind, w, h, d, x, y, z, shadow) {
    var T = this.T;
    var geo = new T.BoxGeometry(w, h, d), mt = this.mat(L, kind);
    if (mt.map) {
      var tile = kind === 'masonry' ? 45 : kind === 'slab' ? 70 : 90, uv = geo.attributes.uv, f = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]], i2, k2;
      for (i2 = 0; i2 < 6; i2++) for (k2 = 0; k2 < 4; k2++) {
        var ix = i2 * 4 + k2;
        uv.setXY(ix, uv.getX(ix) * f[i2][0] / tile, uv.getY(ix) * f[i2][1] / tile);
      }
    }
    var m = new T.Mesh(geo, mt);
    if (KIND_KEY[kind]) m.userData.k = KIND_KEY[kind];
    m.position.set(x, y, z);
    m.castShadow = shadow !== false;
    m.receiveShadow = true;
    L.g.add(m);
    return m;
  };
  // Placa con bordes rebajados, centrada en (x, y, z)
  Builder.prototype.plate = function (L, kind, w, h, th, x, y, z) {
    var m = new this.T.Mesh(plateGeometry(this.T, w, h, th), this.mat(L, kind));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.k = KIND_KEY[kind];
    L.g.add(m);
    return m;
  };
  // Montante suelto de altura hh (apoyado en y = 0), con la geometría guardada
  Builder.prototype.studOf = function (hh) {
    var key = 'h' + Math.round(hh * 10) + (this.prof || '');
    if (!this.studCache[key]) this.studCache[key] = studGeometry(this.T, hh, this.prof);
    return this.studCache[key];
  };
  // Dintel: viga cajón de dos perfiles, de largo len y alto hh, apoyada en y = 0 y con origen en x = 0
  function headerGeometry(THREE, len, hh) {
    var t = 0.22, D = 7;
    return merge(THREE, [
      boxGeo(THREE, len, hh, t, len / 2, hh / 2, D / 2 - t / 2),
      boxGeo(THREE, len, hh, t, len / 2, hh / 2, -(D / 2 - t / 2)),
      boxGeo(THREE, len, t, D, len / 2, t / 2, 0),
      boxGeo(THREE, len, t, D, len / 2, hh - t / 2, 0)
    ]);
  }
  // Marco de una abertura: montantes dobles a los lados (rey y enano), dintel, y enanos arriba y abajo
  Builder.prototype.openingParts = function (L, g, o, h, sm, sep) {
    sep = sep || 40;
    var T = this.T, self = this, HH = 16, cx;
    function put(geo, x, y, k) {
      var m = new T.Mesh(geo, sm);
      m.position.set(x, y, 0);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.k = k;
      g.add(m);
    }
    put(this.studOf(h - 0.44), o.x0 - 7.2, 0.22, 'montante-abertura');               // montante rey, izquierda
    put(this.studOf(h - 0.44), o.x1 + 3.7, 0.22, 'montante-abertura');               // montante rey, derecha
    put(this.studOf(o.y1 - 0.22), o.x0 - 3.5, 0.22, 'montante-abertura');            // montante enano que sostiene el dintel
    put(this.studOf(o.y1 - 0.22), o.x1, 0.22, 'montante-abertura');
    put(headerGeometry(T, o.x1 - o.x0 + 14.6, HH), o.x0 - 7.3, o.y1, 'dintel');
    var topH = h - 0.22 - (o.y1 + HH);
    for (cx = Math.ceil((o.x0 + 3) / sep) * sep; cx < o.x1 - 3; cx += sep) {
      if (topH > 4) put(this.studOf(topH), cx, o.y1 + HH, 'montante-corto');       // montantes cortos sobre el dintel
      if (o.y0 > 0) put(this.studOf(o.y0 - 0.22), cx, 0.22, 'montante-corto');    // y bajo el antepecho
    }
    if (o.y0 > 0) put(trackGeometry(T, o.x1 - o.x0, this.prof), o.x0, o.y0, 'antepecho');    // solera del antepecho
  };
  // Anclaje de esquina: escuadra de acero atornillada al montante y abulonada a la fundación
  Builder.prototype.holdDown = function (L, g, ax, side, sm) {
    var T = this.T, parts = [
      [new T.BoxGeometry(6.5, 34, 0.5), ax, 17, side * 3.75],
      [new T.BoxGeometry(6.5, 0.5, 9), ax, 0.25, side * 8],
      [new T.BoxGeometry(3, 1.2, 3), ax, 1.1, side * 10],
      [new T.CylinderGeometry(0.7, 0.7, 14, 8), ax, -6, side * 10]
    ];
    parts.forEach(function (q) {
      var m = new T.Mesh(q[0], sm);
      m.position.set(q[1], q[2], q[3]);
      m.castShadow = true;
      m.userData.k = 'anclaje';
      g.add(m);
    });
  };
  // Pared de perfiles a lo largo de x (de 0 a len), con soleras y montantes cada 40 cm.
  // opts: dbl (montantes dobles en los extremos), open (aberturas {x0,x1,y0,y1}), straps (tramos con cintas en cruz) y strapSide,
  //       anchors (cara interior, +1 o -1) con anclajes en los extremos
  Builder.prototype.frame = function (L, len, h, x, y, z, rotY, studMat, part, opts) {
    var T = this.T, g = new T.Group(), self = this;
    opts = opts || {};
    var opens = opts.open || [];
    var wantStuds = part !== 'tracks', wantTracks = part !== 'studs';
    var sm = studMat || this.mat(L, 'steel');
    var geoH = this.studOf(h - 0.44);
    var xs = [], px = 0;
    while (px < len - 1) { xs.push(px); px += (opts.sep || 40); }
    xs.push(len);
    if (opts.dbl) { xs.push(3.7); xs.push(len - 3.8); }
    if (opens.length) {
      xs = xs.filter(function (sx) { return !opens.some(function (o) { return sx > o.x0 - 7.6 && sx < o.x1 + 7.6; }); });
    }
    if (wantStuds) {
      var inst = new T.InstancedMesh(geoH, sm, xs.length);
      var m4 = new T.Matrix4();
      xs.forEach(function (sx, i) { m4.makeTranslation(sx, 0.22, 0); inst.setMatrixAt(i, m4); });
      inst.castShadow = true; inst.receiveShadow = true;
      inst.userData.k = 'montante';
      g.add(inst);
      opens.forEach(function (o) { self.openingParts(L, g, o, h, sm, opts.sep); });
      if (opts.straps) {
        var smat = this.mat(L, 'sheet'), side = opts.strapSide || 1;
        opts.straps.forEach(function (bay) {
          var dx = bay[1] - bay[0], dy = h - 2, d = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
          [1, -1].forEach(function (sg) {
            var st = new T.Mesh(new T.BoxGeometry(d, 3.6, 0.3), smat);
            st.position.set((bay[0] + bay[1]) / 2, h / 2, side * 3.85);
            st.rotation.z = sg * ang;
            st.userData.k = 'cinta';
            g.add(st);
          });
        });
      }
      if (opts.anchors) {
        [3.8, len - 3.2].forEach(function (ax) { self.holdDown(L, g, ax, opts.anchors, sm); });
      }
    }
    if (wantTracks) {
      var trg = trackGeometry(T, len + 0.2, this.prof);
      var top = new T.Mesh(trg, this.mat(L, 'steel'));
      top.position.set(-0.1, h, 0);
      top.rotation.x = Math.PI;
      top.castShadow = true;
      top.userData.k = 'solera';
      g.add(top);
      // la solera inferior se corta donde hay una puerta
      var doors = opens.filter(function (o) { return o.y0 <= 0; }).sort(function (a2, b2) { return a2.x0 - b2.x0; });
      var cuts = [], cur = -0.1;
      doors.forEach(function (o) { cuts.push([cur, o.x0]); cur = o.x1; });
      cuts.push([cur, len + 0.1]);
      cuts.forEach(function (c) {
        var bm = new T.Mesh(trackGeometry(T, c[1] - c[0], self.prof), self.mat(L, 'steel'));
        bm.position.set(c[0], 0, 0);
        bm.castShadow = true;
        bm.userData.k = 'solera';
        g.add(bm);
      });
    }
    g.position.set(x, y, z);
    g.rotation.y = rotY || 0;
    L.g.add(g);
    return g;
  };

  // --- una pared armada por etapas (la del cuadro "Cómo se arma una pared en seco")
  function buildWall(THREE, env) {
    var b = new Builder(THREE, env), V = THREE.Vector3;
    b.prof = 'durlock';
    var LEN = 160, H = 120, XO = -LEN / 2;
    var base = b.layer(0);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 300), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true;
    base.g.add(floor);
    b.floor = floor; b.floorParent = base.g;
    // 1 estructura, con la cinta de sellado acústica entre cada solera y el piso o la losa
    var s1 = b.nm(b.layer(1, new V(0, 46, 0)), 'Perfiles de acero');
    b.frame(s1, LEN, H, XO, 0, 0, 0);
    tagk(b.box(s1, 'sheet', LEN, 0.3, 7.0, 0, -0.15, 0, false), 'cinta-sellado');
    tagk(b.box(s1, 'sheet', LEN, 0.3, 7.0, 0, H + 0.15, 0, false), 'cinta-sellado');
    // 2 aislación e instalaciones
    var s2 = b.nm(b.layer(2, new V(0, 0, 40)), 'Aislación');
    for (var i = 0; i < 4; i++) {
      var bat = b.box(s2, 'ins', 36.2, H - 6.5, 5.6, XO + 20 + i * 40, H / 2, 0);
      bat.castShadow = false;
    }
    var s2b = b.nm(b.layer(2, new V(-60, 0, 0)), 'Instalaciones');
    b.box(s2b, 'conduit', LEN - 6, 1.9, 1.9, 0, 38, 0.4);
    b.box(s2b, 'pipe', LEN - 6, 1.5, 1.5, 0, 82, -0.4);
    // 3 placas de 12,5 mm con los bordes largos rebajados. La delantera va en dos filas con las juntas desplazadas
    // (la de abajo en el segundo montante, la de arriba en el tercero) y con el corte para ver el interior; la de atrás es la otra cara
    var front = b.nm(b.layer(3, new V(0, 0, 70)), 'Placas de yeso');
    var FW = LEN * 0.66, HP = H / 2, XA = XO - 1, XB = XO + FW - 1, ZP = 4.2, TH = 1.25;
    function plate(x0, x1, y0, y1) { return b.plate(front, 'boardRaw', x1 - x0, y1 - y0, TH, (x0 + x1) / 2, (y0 + y1) / 2, ZP); }
    var fbs = [
      plate(XA, XO + 40, 0, HP), plate(XO + 40, XB, 0, HP),
      plate(XA, XO + 80, HP, H), plate(XO + 80, XB, HP, H)
    ];
    // tornillos para placas (cabeza trompeta) cada 25 cm, a los dos lados de cada junta vertical y de la horizontal
    var pts = [];
    [[10, 35, 57.5], [62.5, 85, 110]].forEach(function (rows, ri) {
      var cols = ri === 0 ? [0, 37.5, 42.5, 80] : [0, 40, 77.5, 82.5];
      rows.forEach(function (sy) { cols.forEach(function (sx) { pts.push([XO + sx, sy]); }); });
    });
    var screws = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.15, 0.3, 10), b.mat(front, 'screw'), pts.length);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    pts.forEach(function (pt, n) { m4.compose(new V(pt[0], pt[1], ZP + TH / 2 + 0.05), q, new V(1, 1, 1)); screws.setMatrixAt(n, m4); });
    tagk(screws, 'tornillo');
    front.g.add(screws);
    var back = b.nm(b.layer(3, new V(0, 0, -70)), 'Placas de yeso');
    var bb = b.plate(back, 'boardRaw', LEN + 2, H, TH, 0, H / 2, -ZP);
    bb.rotation.y = Math.PI;       // el rebaje queda del lado de afuera
    // 4 terminación: masilla (20 cm) y cinta de papel (50 mm) sobre las juntas, y masilla sobre las cabezas de los tornillos
    var fin = b.nm(b.layer(4, new V(0, 0, 0)), 'Juntas y zócalos');
    var ZF = ZP + TH / 2 + 0.05;
    function jointV(x, y0, y1) {       // junta vertical: cinta de 5 cm y masilla de 20 cm
      tagk(b.box(fin, 'paint', 20, y1 - y0, 0.1, x, (y0 + y1) / 2, ZF, false), 'junta');
      tagk(b.box(fin, 'sheet', 5, y1 - y0, 0.14, x, (y0 + y1) / 2, ZF + 0.07, false), 'junta');
    }
    function jointH(x0, x1, y) {       // junta horizontal, sobre el rebaje de los bordes largos
      tagk(b.box(fin, 'paint', x1 - x0, 20, 0.1, (x0 + x1) / 2, y, ZF, false), 'junta');
      tagk(b.box(fin, 'sheet', x1 - x0, 5, 0.14, (x0 + x1) / 2, y, ZF + 0.07, false), 'junta');
    }
    jointV(XO + 40, 0, HP); jointV(XO + 80, HP, H); jointH(XA, XB, HP);
    var putty = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.4, 0.25), b.mat(fin, 'sheet'), pts.length);
    var pm = new THREE.Matrix4();
    pts.forEach(function (pt, n) { pm.makeTranslation(pt[0], pt[1], ZF + 0.1); putty.setMatrixAt(n, pm); });
    tagk(putty, 'masilla');
    fin.g.add(putty);
    // zócalos al pie de las dos placas
    tagk(b.box(fin, 'frame', FW, 8, 1.2, XO + FW / 2 - 1, 4, 5.4, false), 'zocalo');
    tagk(b.box(fin, 'frame', LEN + 2, 8, 1.2, 0, 4, -5.4, false), 'zocalo');
    fin.paintTargets = fbs.concat([bb]);
    b.paint = fbs.map(function (m) { return m.material; }).concat([bb.material]);
    b.fin = fin;
    // 5 pared terminada: la placa delantera cubre todo el ancho, con su propia junta tomada
    var s5 = b.nm(b.layer(5, new V(0, 50, 0)), 'Placas de yeso');
    var rest = b.plate(s5, 'boardRaw', LEN - FW + 2, H, TH, XO + FW + (LEN - FW) / 2 - 1, H / 2, ZP);
    b.paint.push(rest.material);
    tagk(b.box(s5, 'paint', 20, H, 0.1, XB, H / 2, ZF, false), 'junta');
    tagk(b.box(s5, 'sheet', 5, H, 0.14, XB, H / 2, ZF + 0.07, false), 'junta');
    tagk(b.box(s5, 'frame', LEN - FW + 2, 8, 1.2, XO + FW + (LEN - FW) / 2 - 1, 4, 5.4, false), 'zocalo');
    return b;
  }


  function floorFor(THREE, b, w, d) {
    var base = b.layer(0);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true;
    base.g.add(floor);
    b.floor = floor; b.floorParent = base.g;
  }

  // Panel de Steel Frame: soleras, montantes y cintas de rigidización
  function buildPanel(THREE, env) {
    var b = new Builder(THREE, env), V = THREE.Vector3;
    var LEN = 200, H = 120, XO = -LEN / 2;
    floorFor(THREE, b, 700, 400);
    var l1 = b.nm(b.layer(1, new V(0, 40, 0)), 'Soleras');
    b.frame(l1, LEN, H, XO, 0, 0, 0, null, 'tracks');
    var l2 = b.nm(b.layer(2, new V(0, 70, 0)), 'Montantes');
    b.frame(l2, LEN, H, XO, 0, 0, 0, null, 'studs', { dbl: true });
    var l3 = b.nm(b.layer(3, new V(0, 0, 45)), 'Cintas de rigidización');
    var len = Math.sqrt(80 * 80 + 108 * 108), ang = Math.atan2(108, 80);
    [1, -1].forEach(function (sg) {
      var m = b.box(l3, 'sheet', len, 3.6, 0.3, XO + 80, 60, 3.95);
      m.rotation.z = sg * ang;
      m.userData.k = 'cinta';
    });
    b.az0 = 0.6; b.el0 = 0.2;
    return b;
  }

  // Cielorraso suspendido: muros, losa, cuelgas, ángulo perimetral, perfiles que cargan (con un empalme solapado),
  // perfiles omega donde se atornilla la placa, y placas trabadas con una separación contra los muros
  function buildCeiling(THREE, env) {
    var b = new Builder(THREE, env), V = THREE.Vector3;
    var W = 300, D = 160, x;
    floorFor(THREE, b, 800, 500);
    var l1 = b.nm(b.layer(1, new V(0, 45, 0)), 'Losa y cuelgas');
    tagk(b.box(l1, 'slab', W, 14, D, 0, 67, 0), 'losa');
    // cuelgas: varillas de 6 mm
    [-100, 0, 100].forEach(function (rx) {
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 54.5, 8), b.mat(l1, 'steel'));
      rod.position.set(rx, 32.75, 0); rod.castShadow = true; rod.userData.k = 'varilla'; l1.g.add(rod);
    });
    [-1, 1].forEach(function (sd) { tagk(b.box(l1, 'masonry', 6, 74, D, sd * (W / 2 + 3), 37, 0), 'muro'); });
    // ángulo perimetral contra cada muro (perfil en L de 20 x 20 mm), a la altura de la línea de nivel
    var la = b.nm(b.layer(1, new V(0, 45, 0)), 'Ángulo perimetral');
    [-1, 1].forEach(function (sd) {
      tagk(b.box(la, 'steel', 0.22, 2, D, sd * (W / 2 - 0.11), 1, 0), 'angulo');
      tagk(b.box(la, 'steel', 2, 0.22, D, sd * (W / 2 - 1), 0.11, 0), 'angulo');
    });
    var l2 = b.nm(b.layer(2, new V(0, -40, 0)), 'Perfiles');
    // perfiles que cargan (forma del montante de 34 mm): dos tramos con un empalme solapado atornillado, sin tocar los muros
    function carrier(len) {
      var g = studGeometry(THREE, len, 'durlock', 3.4);
      g.rotateZ(-Math.PI / 2);
      return g;
    }
    var c1 = new THREE.Mesh(carrier(205), b.mat(l2, 'steel')); c1.position.set(-145, 5.5, -1.0); c1.castShadow = true; c1.userData.k = 'perfil-carga'; l2.g.add(c1);
    var c2 = new THREE.Mesh(carrier(115), b.mat(l2, 'steel')); c2.position.set(30, 5.5, 1.0); c2.castShadow = true; c2.userData.k = 'perfil-carga'; l2.g.add(c2);
    [36, 42, 48, 54].forEach(function (sx) { tagk(b.box(l2, 'screw', 1.4, 0.5, 1.4, sx, 5.8, 0, false), 'tornillo-perfil'); });
    // perfiles omega (70 x 13 mm) perpendiculares, a 60 cm entre ejes, con las alas contra la placa
    var og = omegaGeometry(THREE, D - 10);
    for (x = -120; x <= 120; x += 60) {
      var om = new THREE.Mesh(og, b.mat(l2, 'steel'));
      om.position.set(x, 0.7, 0); om.castShadow = true; om.userData.k = 'perfil-placa'; l2.g.add(om);
    }
    // placas de cielorraso de 7 mm: dos filas perpendiculares a los perfiles, con las juntas trabadas y una separación contra los muros
    var l3 = b.nm(b.layer(3, new V(0, -75, 0)), 'Placa');
    function pl(x0, x1, z0, z1) { tagk(b.box(l3, 'boardRaw', x1 - x0 - 0.6, 0.7, z1 - z0 - 0.6, (x0 + x1) / 2, 0.35, (z0 + z1) / 2), 'placa-cielo'); }
    pl(-147, 0, -77, -1); pl(0, 147, -77, -1);
    pl(-147, -75, 1, 77); pl(-75, 75, 1, 77); pl(75, 147, 1, 77);
    // cornisas: molduras en el encuentro de cada muro con el cielorraso (último paso)
    var l4 = b.nm(b.layer(4, new V(0, -75, 0)), 'Cornisas');
    [-1, 1].forEach(function (sd) { tagk(b.box(l4, 'frame', 6.5, 6.5, D, sd * (W / 2 - 3.25), -3.25, 0, false), 'cornisa'); });
    b.az0 = 0.55; b.el0 = 0.12;
    return b;
  }

  // Fundación: platea de hormigón con armadura y un panel apoyado
  function buildPlatea(THREE, env) {
    var b = new Builder(THREE, env), V = THREE.Vector3, i;
    floorFor(THREE, b, 900, 600);
    // primero se arma la armadura sobre separadores y después se hormigona encima
    var l1 = b.nm(b.layer(1, new V(0, 35, 0)), 'Armadura');
    for (i = -100; i <= 100; i += 25) tagk(b.box(l1, 'steel', 320, 1, 1, 0, -4.2, i), 'armadura');
    for (i = -150; i <= 150; i += 30) tagk(b.box(l1, 'steel', 1, 1, 230, i, -3.2, 0), 'armadura');
    var l2 = b.nm(b.layer(2, new V(0, 40, 0)), 'Hormigón');
    tagk(b.box(l2, 'slab', 330, 14, 240, 0, -7, 0), 'platea');
    var l3 = b.nm(b.layer(3, new V(0, 70, 0)), 'Panel y anclajes');
    b.frame(l3, 250, 110, -125, 0, -40, 0, null, null, { dbl: true, anchors: 1 });
    b.az0 = 0.62; b.el0 = 0.34;
    return b;
  }

  // --- vista previa de lo que se carga en el cómputo (medidas en cm). P = { tipo, L, A, H, sep, dbl, ops: [{wall, t, x0, x1, y0, y1, w, h, sill}], boardT, caras, capas, visibles }
  function stripsFor(len, h, ops) {
    // un tablero con huecos: tiras enteras entre las aberturas y trozos arriba y abajo de cada una
    var out = [], cur = 0;
    ops.slice().sort(function (a, b) { return a.x0 - b.x0; }).forEach(function (o) {
      if (o.x0 > cur) out.push({ x: cur, y: 0, w: o.x0 - cur, h: h });
      if (h > o.y1) out.push({ x: o.x0, y: o.y1, w: o.x1 - o.x0, h: h - o.y1 });
      if (o.y0 > 0) out.push({ x: o.x0, y: 0, w: o.x1 - o.x0, h: o.y0 });
      cur = Math.max(cur, o.x1);
    });
    if (len > cur) out.push({ x: cur, y: 0, w: len - cur, h: h });
    return out;
  }
  function buildParam(THREE, env, P) {
    var b = new Builder(THREE, env), V = THREE.Vector3, PI = Math.PI;
    P = P || {};
    var L = P.L || 600, A = P.A || 400, H = P.H || 250, sep = P.sep || 40, tipo = P.tipo || 'vivienda';
    var vis = P.visibles || null;
    function show(name) { return !vis || vis.indexOf(name) !== -1; }
    function named(layer, name) { b.nm(layer, name); layer.hidden = !show(name); return layer; }
    floorFor(THREE, b, Math.max(L, A) * 3, Math.max(L, A) * 2.4);
    var step = 0;

    if (tipo === 'cielorraso') {
      var l1 = named(b.layer(++step, new V(0, 40, 0)), 'Losa y cuelgas');
      tagk(b.box(l1, 'slab', L + 20, 14, A + 20, 0, 77, 0), 'losa');
      var l2 = named(b.layer(++step, new V(0, -30, 0)), 'Perfiles');
      var rows = P.sepPerf ? Math.floor(A / P.sepPerf) + 1 : 3, k;
      for (k = 0; k < rows; k++) {
        var zz = rows === 1 ? 0 : -A / 2 + (A / (rows - 1)) * k;
        tagk(b.box(l2, 'steel', L - 4, 4, 6, 0, 56, zz), 'perfil-cielo');
      }
      [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(function (q) { tagk(b.box(l2, 'steel', 1, 18, 1, q[0] * L, 66, q[1] * A), 'varilla'); });
      var l3 = named(b.layer(++step, new V(0, -60, 0)), 'Placa');
      tagk(b.box(l3, 'board', L, 1.25, A, 0, 52.5, 0), 'placa-cielo');
      b.az0 = 0.55; b.el0 = 0.2;
      return b;
    }

    var walls;
    if (tipo === 'tabique') {
      walls = [{ len: L, origin: [-L / 2, 0, 0], rotY: 0, d: [1, 0, 0], n: [0, 0, 1], ry: 0 }];
    } else {
      walls = [
        { len: L, origin: [-L / 2, 0, A / 2], rotY: 0, d: [1, 0, 0], n: [0, 0, 1], ry: 0 },
        { len: A, origin: [L / 2, 0, -A / 2], rotY: -PI / 2, d: [0, 0, 1], n: [1, 0, 0], ry: PI / 2 },
        { len: L, origin: [-L / 2, 0, -A / 2], rotY: 0, d: [1, 0, 0], n: [0, 0, -1], ry: PI },
        { len: A, origin: [-L / 2, 0, -A / 2], rotY: -PI / 2, d: [0, 0, 1], n: [-1, 0, 0], ry: -PI / 2 }
      ];
    }
    var opsBy = walls.map(function () { return []; });
    (P.ops || []).forEach(function (o) { if (opsBy[o.wall]) opsBy[o.wall].push(o); });

    if (tipo !== 'tabique') {
      var lp = named(b.layer(++step, new V(0, -30, 0)), 'Platea');
      tagk(b.box(lp, 'slab', L + 40, 16, A + 40, 0, -8, 0), 'platea');
    }
    var st = named(b.layer(++step, new V(0, 80, 0)), tipo === 'tabique' ? 'Perfiles de acero' : 'Perfiles de acero');
    walls.forEach(function (w, i) {
      b.frame(st, w.len, H, w.origin[0], 0, w.origin[2], w.rotY, null, null, { dbl: !!P.dbl, open: opsBy[i], sep: sep });
    });
    if (tipo === 'tabique' && P.aislacion) {
      var li = named(b.layer(++step, new V(0, 0, 40)), 'Aislación');
      var cuts = [0].concat(opsBy[0].map(function (o) { return o.x0; }));
      stripsFor(L, H - 8, opsBy[0]).forEach(function (q) {
        var bat = tagk(b.box(li, 'ins', q.w, q.h - 4, 5.6, -L / 2 + q.x + q.w / 2, q.y + q.h / 2, 0), 'ins');
        bat.castShadow = false;
      });
    }

    // aberturas: ventana con marco, o puerta con marco
    var lo = named(b.layer(++step, new V(0, 0, 40)), 'Aberturas');
    walls.forEach(function (w, i) {
      opsBy[i].forEach(function (o) {
        var g = new THREE.Group(), cx = (o.x0 + o.x1) / 2, off = 7;
        if (o.t === 'v') {
          var gl = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 1), b.mat(lo, 'glass'));
          g.add(gl);
          [[o.w + 5, 3, 3, 0, o.h / 2 + 1.5], [o.w + 5, 3, 3, 0, -o.h / 2 - 1.5], [3, o.h, 3, o.w / 2 + 1.5, 0], [3, o.h, 3, -o.w / 2 - 1.5, 0]].forEach(function (f) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(f[0], f[1], f[2]), b.mat(lo, 'frame'));
            m.position.set(f[3], f[4], 0.4);
            g.add(m);
          });
          g.position.set(0, o.sill + o.h / 2, 0);
        } else {
          var leaf = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 3), b.mat(lo, 'wood'));
          g.add(leaf);
          [[4, o.h + 4, 5, -o.w / 2 - 2, 2], [4, o.h + 4, 5, o.w / 2 + 2, 2], [o.w + 8, 4, 5, 0, o.h / 2 + 2]].forEach(function (f) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(f[0], f[1], f[2]), b.mat(lo, 'frame'));
            m.position.set(f[3], f[4], 0);
            g.add(m);
          });
          g.position.set(0, o.h / 2, 0);
        }
        var holder = new THREE.Group();
        holder.add(g);
        holder.position.set(w.origin[0] + w.d[0] * cx + w.n[0] * off, 0, w.origin[2] + w.d[2] * cx + w.n[2] * off);
        holder.rotation.y = w.ry;
        holder.userData.k = o.t === 'v' ? 'ventana' : 'puerta';
        lo.g.add(holder);
      });
    });

    // tableros: exterior (OSB) e interior (placas de yeso), con sus huecos
    function boards(layerName, kind, tagKey, thick, outerOffset, inner) {
      var ly = named(b.layer(++step, new V(inner ? 0 : 0, 0, inner ? -50 : 60)), layerName);
      walls.forEach(function (w, i) {
        var side = inner ? -1 : 1;
        stripsFor(w.len, H, opsBy[i]).forEach(function (q) {
          var cx = q.x + q.w / 2, cy = q.y + q.h / 2, off = side * outerOffset;
          var pos = [w.origin[0] + w.d[0] * cx + w.n[0] * off, cy, w.origin[2] + w.d[2] * cx + w.n[2] * off];
          var alongX = w.d[0] !== 0;
          var m = tagk(b.box(ly, kind, alongX ? q.w : thick, q.h, alongX ? thick : q.w, pos[0], pos[1], pos[2]), tagKey);
          m.castShadow = true;
        });
      });
    }
    if (tipo === 'tabique') {
      var caras = P.caras === 1 ? 1 : 2, capas = P.capas === 2 ? 2 : 1, t = 1.25 * capas;
      var lb = named(b.layer(++step, new V(0, 0, 60)), 'Placas de yeso');
      [1, -1].slice(0, caras).forEach(function (sd) {
        stripsFor(L, H, opsBy[0]).forEach(function (q) {
          tagk(b.box(lb, 'board', q.w, q.h, t, -L / 2 + q.x + q.w / 2, q.y + q.h / 2, sd * (3.5 + t / 2 + 0.1)), 'board');
        });
      });
    } else {
      boards('Cerramiento exterior', 'osb', 'osb', 1.8, 3.5 + 0.9 + 0.1, false);
      var li2 = P.capas === 2 ? 2 : 1;
      boards('Placas interiores', 'board', 'board', 1.25 * li2, 3.5 + 0.625 * li2 + 0.1, true);
    }
    b.az0 = 0.62; b.el0 = 0.32;
    return b;
  }

  // --- obras completas (para "Qué se puede armar")
  function buildBuilding(THREE, env, kind) {
    var b = new Builder(THREE, env), V = THREE.Vector3, PI = Math.PI;
    var base = b.layer(0);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1100), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -PI / 2; floor.position.y = -0.1; floor.receiveShadow = true;
    base.g.add(floor);
    b.floor = floor; b.floorParent = base.g;
    var I, WD = 600, DP = 420, HT = 250, i, x, z;

    function windowAt(L, wx, wy, wz, ww, wh, ry) {
      var g = new THREE.Group();
      var gl = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 1), b.mat(L, 'glass'));
      g.add(gl);
      [[ww + 5, 3, 3, 0, wh / 2 + 1.5], [ww + 5, 3, 3, 0, -wh / 2 - 1.5], [3, wh, 3, ww / 2 + 1.5, 0], [3, wh, 3, -ww / 2 - 1.5, 0]].forEach(function (f) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(f[0], f[1], f[2]), b.mat(L, 'frame'));
        m.position.set(f[3], f[4], 0.4);
        g.add(m);
      });
      var sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 12, 3, 8), b.mat(L, 'frame'));
      sill.position.set(0, -wh / 2 - 4.5, 3);
      g.add(sill);
      g.position.set(wx, wy, wz);
      g.rotation.y = ry || 0;
      g.userData.k = 'ventana';
      L.g.add(g);
    }

    if (kind === 'vivienda' || kind === 'ampliacion') {
      var wy0 = 0;       // altura del piso del nivel nuevo
      if (kind === 'ampliacion') {
        var ex = b.nm(b.layer(1, new V(0, 0, 0), 1), 'Construcción existente');
        var exist = b.box(ex, 'masonry', WD, 240, DP, 0, 120, 0);
        windowAt(ex, -150, 130, DP / 2 + 0.6, 80, 100, 0);
        windowAt(ex, 150, 130, DP / 2 + 0.6, 80, 100, 0);
        windowAt(ex, WD / 2 + 0.6, 130, 0, 80, 100, PI / 2);
        tagk(b.box(ex, 'wood', 90, 200, 4, 0, 100, DP / 2 + 1), 'puerta');
        var slab0 = b.layer(0);
        b.box(slab0, 'slab', WD + 30, 12, DP + 30, 0, -6, 0);
        wy0 = 240;
        var ent = b.nm(b.layer(2, new V(0, 60, 0)), 'Entrepiso');
        tagk(b.box(ent, 'slab', WD + 24, 18, DP + 24, 0, wy0 + 9, 0), 'entrepiso');
        wy0 += 18;
      } else {
        var sl = b.nm(b.layer(1, new V(0, -30, 0)), 'Platea');
        tagk(b.box(sl, 'slab', WD + 40, 16, DP + 40, 0, -8, 0), 'platea');
      }
      var kS = kind === 'vivienda' ? 2 : 3;
      var st = b.nm(b.layer(kS, new V(0, 80, 0)), 'Perfiles de acero');
      var WIN = function (cx) { return { x0: cx - 53, x1: cx + 53, y0: 92, y1: 204 }; };
      var frontOpen = [WIN(130), WIN(340), kind === 'vivienda' ? { x0: 447, x1: 553, y0: 0, y1: 208 } : WIN(500)];
      b.frame(st, WD, HT, -WD / 2, wy0, -DP / 2, 0, null, null, { dbl: true, straps: [[0, 200], [400, 600]], strapSide: -1, anchors: 1 });
      b.frame(st, DP, HT, -WD / 2, wy0, -DP / 2, -PI / 2, null, null, { dbl: true, straps: [[0, 210]], strapSide: 1, anchors: -1 });
      b.frame(st, WD, HT, -WD / 2, wy0, DP / 2, 0, null, null, { dbl: true, open: frontOpen, anchors: -1 });
      b.frame(st, DP, HT, WD / 2, wy0, -DP / 2, -PI / 2, null, null, { dbl: true, open: [WIN(130)], straps: [[190, 415]], strapSide: -1, anchors: 1 });
      var kC = kS + 1;
      var cl = b.nm(b.layer(kC, new V(0, 0, 90)), 'Cerramiento exterior');
      var CW = WD * 0.6;
      b.box(cl, 'osb', WD, HT, 2, 0, wy0 + HT / 2, -DP / 2 - 5);
      b.box(cl, 'osb', 2, HT, DP, -WD / 2 - 5, wy0 + HT / 2, 0);
      b.box(cl, 'osb', CW, HT, 2, -WD / 2 + CW / 2, wy0 + HT / 2, DP / 2 + 5);
      b.box(cl, 'osb', 2, HT, DP * 0.6, WD / 2 + 5, wy0 + HT / 2, -DP / 2 + DP * 0.3);
      var kR = kC + 1;
      var rf = b.nm(b.layer(kR, new V(0, 90, 0)), 'Techo');
      var rise = 95, half = DP / 2 + 25, len = Math.sqrt(half * half + rise * rise), ang = Math.atan2(rise, half);
      var topY = wy0 + HT;
      if (kind === 'vivienda') {
        for (x = -WD / 2; x <= WD / 2; x += 60) {
          [1, -1].forEach(function (s) {
            var r = tagk(b.box(rf, 'steel', 4, 9, len, x, topY + rise / 2 + 4, s * half / 2), 'cabio');
            r.rotation.x = s * ang;
          });
        }
        var cov = b.box(rf, 'roof', WD * 0.62, 1.6, len + 18, -WD / 2 + WD * 0.31, topY + rise / 2 + 14, half / 2);
        cov.rotation.x = ang;
      } else {
        tagk(b.box(rf, 'slab', WD + 50, 14, DP + 50, 0, topY + 7, 0), 'techo-losa');
      }
      var kW = kR + 1;
      var op = b.nm(b.layer(kW, new V(0, 0, 40)), 'Aberturas');
      windowAt(op, -170, wy0 + 150, DP / 2 + 8, 90, 100, 0);
      windowAt(op, 40, wy0 + 150, DP / 2 + 8, 90, 100, 0);
      if (kind === 'vivienda') {
        tagk(b.box(op, 'wood', 90, 200, 4, 200, wy0 + 100, DP / 2 + 8), 'puerta');
        tagk(b.box(op, 'frame', 4, 206, 5, 200 - 47, wy0 + 103, DP / 2 + 8), 'puerta');
        tagk(b.box(op, 'frame', 4, 206, 5, 200 + 47, wy0 + 103, DP / 2 + 8), 'puerta');
        tagk(b.box(op, 'frame', 98, 4, 5, 200, wy0 + 204, DP / 2 + 8), 'puerta');
        tagk(b.box(op, 'steel', 10, 2, 5, 200 + 32, wy0 + 100, DP / 2 + 11.5, false), 'puerta');
      } else {
        windowAt(op, 200, wy0 + 150, DP / 2 + 8, 90, 100, 0);   // en la planta alta no hay puerta de acceso: va otra ventana
      }
      windowAt(op, WD / 2 + 8, wy0 + 150, -80, 90, 100, PI / 2);
      var fn = b.nm(b.layer(kind === 'vivienda' ? kW + 1 : kW, new V(0, 0, 0)), 'Terminación');
      // lo que faltaba para cerrar la obra: cerramientos, techo completo y frontones
      var restW = WD - CW, restD = DP * 0.4;
      var fnPaint = [];
      fnPaint.push(b.box(fn, 'osb', restW, HT, 2, -WD / 2 + CW + restW / 2, wy0 + HT / 2, DP / 2 + 5).material);
      fnPaint.push(b.box(fn, 'osb', 2, HT, restD, WD / 2 + 5, wy0 + HT / 2, -DP / 2 + DP * 0.6 + restD / 2).material);
      if (kind === 'vivienda') {
        var cov2 = b.box(fn, 'roof', WD * 0.38 + 8, 1.6, len + 18, -WD / 2 + WD * 0.62 + WD * 0.19 + 2, topY + rise / 2 + 14, half / 2);
        cov2.rotation.x = ang;
        var cov3 = b.box(fn, 'roof', WD + 16, 1.6, len + 18, 0, topY + rise / 2 + 14, -half / 2);
        cov3.rotation.x = -ang;
        [-1, 1].forEach(function (sx) {
          var sh = new THREE.Shape();
          sh.moveTo(-DP / 2 - 5, 0); sh.lineTo(DP / 2 + 5, 0); sh.lineTo(0, rise + 8); sh.closePath();
          var gg = new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false });
          gg.rotateY(Math.PI / 2);
          var gmat = b.mat(fn, 'osb');
          fnPaint.push(gmat);
          var gm2 = tagk(new THREE.Mesh(gg, gmat), 'osb');
          gm2.position.set(sx * (WD / 2 + 4) - (sx > 0 ? 0 : 2), topY, 0);
          gm2.castShadow = true; gm2.receiveShadow = true;
          fn.g.add(gm2);
        });
      }
      b.osbMats = cl.mats;
      b.finishMats = cl.mats;
      b.fin = fn;
      b.paint = cl.mats.concat(fnPaint);
      if (kind === 'vivienda') {
        tagk(b.box(fn, 'steel', WD + 24, 3, 16, 0, topY + rise + 18, 0, false), 'cumbrera');            // cumbrera
        b.box(fn, 'slab', 140, 10, 50, 200, 5, DP / 2 + 32);                           // escalón de acceso
      } else {
        [[WD + 50, 8, 2, 0, topY + 18, DP / 2 + 25], [WD + 50, 8, 2, 0, topY + 18, -DP / 2 - 25], [2, 8, DP + 50, WD / 2 + 25, topY + 18, 0], [2, 8, DP + 50, -WD / 2 - 25, topY + 18, 0]].forEach(function (r) {
          b.box(fn, 'slab', r[0], r[1], r[2], r[3], r[4], r[5], false);               // borde de la losa de techo
        });
      }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (cs) {
        tagk(b.box(fn, 'frame', 4, HT, 4, cs[0] * (WD / 2 + 5), wy0 + HT / 2, cs[1] * (DP / 2 + 5), false), 'esquinero');   // esquineros de la terminación exterior
      });
      fn.off.set(0, 50, 0);
    } else {
      // interiores: local comercial y oficinas
      var W = 700, D = 500, Hh = 260;
      var sh = b.layer(0);
      b.box(sh, 'slab', W + 30, 14, D + 30, 0, -7, 0);
      b.box(sh, 'masonry', W, Hh + 20, 18, 0, (Hh + 20) / 2, -D / 2 + 9);
      b.box(sh, 'masonry', 18, Hh + 20, D, -W / 2 + 9, (Hh + 20) / 2, 0);
      var rep = b.nm(b.layer(1, new V(0, 0, 0)), 'Replanteo');
      var segs = kind === 'local'
        ? [[60, -D / 2 + 18, 60, 10], [60, 10, 340, 10]]
        : [[-160, -D / 2 + 18, -160, 130], [-330, 130, 330, 130], [110, 130, 110, D / 2 - 8]];
      segs.forEach(function (s) {
        var dx = s[2] - s[0], dz = s[3] - s[1], L2 = Math.sqrt(dx * dx + dz * dz);
        for (var t = 0; t < L2; t += 24) {
          var seg = b.box(rep, 'mark', Math.min(12, L2 - t), 0.6, 4, s[0] + dx * (t + 6) / L2, 0.3, s[1] + dz * (t + 6) / L2, false);
          seg.rotation.y = -Math.atan2(dz, dx);
        }
      });
      b.prof = 'durlock';
      var fr = b.nm(b.layer(2, new V(0, 70, 0)), 'Estructura de tabiques');
      var runs = kind === 'local'
        ? [[60, -D / 2 + 18, 242, PI / 2, 'z'], [60, 10, 280, 0, 'x']]
        : [[-160, -D / 2 + 18, 130 + D / 2 - 18, PI / 2, 'z'], [-330, 130, 660, 0, 'x'], [110, 130, D / 2 - 8 - 130, PI / 2, 'z']];
      var doorOpen = function (c) { return { x0: c - 50, x1: c + 50, y0: 0, y1: 208 }; };
      runs.forEach(function (r, ri) {
        var op = [];
        if (kind === 'local' && ri === 1) op = [doorOpen(130)];
        if (kind !== 'local' && ri === 1) op = [doorOpen(80)];
        if (kind !== 'local' && ri === 2) op = [doorOpen(55)];
        var g = b.frame(fr, r[2], Hh - 8, r[0], 0, r[1], r[3] === PI / 2 ? -PI / 2 : 0, null, null, { open: op });
        if (r[4] === 'z') { g.position.set(r[0], 0, r[1]); }
      });
      b.prof = null;
      var sv = b.nm(b.layer(3, new V(0, 0, 50)), 'Aislación');
      runs.forEach(function (r) {
        var along = r[2];
        var bat = b.box(sv, 'ins', r[4] === 'x' ? along * 0.5 : 5.6, Hh - 40, r[4] === 'x' ? 5.6 : along * 0.5, r[4] === 'x' ? r[0] + along * 0.27 : r[0], (Hh - 40) / 2 + 10, r[4] === 'x' ? r[1] : r[1] + along * 0.27);
        bat.castShadow = false;
      });
      var cd = b.nm(b.layer(3, new V(0, 0, 0)), 'Instalaciones');
      runs.forEach(function (r) {
        b.box(cd, 'conduit', r[4] === 'x' ? r[2] - 8 : 1.9, r[4] === 'x' ? 1.9 : 1.9, r[4] === 'x' ? 1.9 : r[2] - 8, r[4] === 'x' ? r[0] + r[2] / 2 : r[0], 130, r[4] === 'x' ? r[1] : r[1] + r[2] / 2);
      });
      var bd = b.nm(b.layer(4, new V(0, 0, 60)), 'Placas de yeso');
      runs.forEach(function (r) {
        var along = r[2];
        [-1, 1].forEach(function (sd) {
          b.box(bd, 'board', r[4] === 'x' ? along : 1.25, Hh - 8, r[4] === 'x' ? 1.25 : along, r[4] === 'x' ? r[0] + along / 2 : r[0] + sd * 4.1, (Hh - 8) / 2, r[4] === 'x' ? r[1] + sd * 4.1 : r[1] + along / 2);
        });
      });
      var ce = b.nm(b.layer(5, new V(0, -60, 0)), 'Cielorraso');
      var CWd = kind === 'local' ? 330 : 420, CDp = kind === 'local' ? 220 : 240;
      var cx = kind === 'local' ? -W / 2 + 18 + CWd / 2 + 6 : -W / 2 + 18 + CWd / 2 + 6;
      var cz = -D / 2 + 18 + CDp / 2 + 6;
      tagk(b.box(ce, 'board', CWd, 1.4, CDp, cx, Hh - 14, cz), 'placa-cielo');
      for (x = -CWd / 2 + 40; x < CWd / 2; x += 80) tagk(b.box(ce, 'steel', 3, 4, CDp, cx + x, Hh - 11.5, cz), 'perfil-cielo');
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { tagk(b.box(ce, 'steel', 0.6, 40, 0.6, cx + s[0] * CWd * 0.38, Hh + 6, cz + s[1] * CDp * 0.38), 'varilla'); });
      var ac = b.nm(b.layer(6, new V(0, 0, 0)), 'Terminación y equipamiento');
      // piso terminado y paredes pintadas
      b.box(ac, 'tile', W - 18, 0.8, D - 18, 9, 0.4, 9, false);
      b.box(ac, 'paint', W - 18, Hh + 20, 0.4, 9, (Hh + 20) / 2, -D / 2 + 18.2, false);
      b.box(ac, 'paint', 0.4, Hh + 20, D - 18, -W / 2 + 18.2, (Hh + 20) / 2, 9, false);
      // zócalos a los dos lados de cada tabique
      runs.forEach(function (r) {
        [-1, 1].forEach(function (sd) {
          if (r[4] === 'x') tagk(b.box(ac, 'frame', r[2], 8, 1.2, r[0] + r[2] / 2, 4, r[1] + sd * 5.6, false), 'zocalo');
          else tagk(b.box(ac, 'frame', 1.2, 8, r[2], r[0] + sd * 5.6, 4, r[1] + r[2] / 2, false), 'zocalo');
        });
      });
      // cornisas: molduras en el encuentro de las paredes y de los tabiques con el cielorraso
      var yC = Hh - 14.7 - 3.25, cx0 = cx - CWd / 2, cx1 = cx + CWd / 2, cz0 = cz - CDp / 2, cz1 = cz + CDp / 2;
      function cornice(xa, xb, za, zb) { tagk(b.box(ac, 'frame', xb - xa, 6.5, zb - za, (xa + xb) / 2, yC, (za + zb) / 2, false), 'cornisa'); }
      cornice(-W / 2 + 18.4, cx1, -D / 2 + 18.4, -D / 2 + 18.4 + 6.5);
      cornice(-W / 2 + 18.4, -W / 2 + 18.4 + 6.5, -D / 2 + 18.4 + 6.5, cz1);
      runs.forEach(function (r) {
        [-1, 1].forEach(function (sd) {
          var off = sd * 7.95;
          if (r[4] === 'x') {
            var xa = Math.max(r[0], cx0), xb = Math.min(r[0] + r[2], cx1);
            if (xb > xa && r[1] > cz0 - 10 && r[1] < cz1 + 10) cornice(xa, xb, r[1] + off - 3.25, r[1] + off + 3.25);
          } else {
            var za = Math.max(r[1], cz0), zb2 = Math.min(r[1] + r[2], cz1);
            if (zb2 > za && r[0] > cx0 - 10 && r[0] < cx1 + 10) cornice(r[0] + off - 3.25, r[0] + off + 3.25, za, zb2);
          }
        });
      });
      // puerta con marco y manija, apoyada sobre la cara del tabique
      function door(dx, dz, alongX) {
        var wd = 90, ht = 205, i2;
        if (alongX) {
          tagk(b.box(ac, 'wood', wd, ht, 3, dx, ht / 2, dz), 'puerta');
          tagk(b.box(ac, 'frame', 4, ht + 4, 5, dx - wd / 2 - 2, (ht + 4) / 2, dz, false), 'puerta');
          tagk(b.box(ac, 'frame', 4, ht + 4, 5, dx + wd / 2 + 2, (ht + 4) / 2, dz, false), 'puerta');
          tagk(b.box(ac, 'frame', wd + 8, 4, 5, dx, ht + 2, dz, false), 'puerta');
          tagk(b.box(ac, 'steel', 10, 2, 5, dx + wd / 2 - 10, 100, dz + 2, false), 'puerta');
        } else {
          tagk(b.box(ac, 'wood', 3, ht, wd, dx, ht / 2, dz), 'puerta');
          tagk(b.box(ac, 'frame', 5, ht + 4, 4, dx, (ht + 4) / 2, dz - wd / 2 - 2, false), 'puerta');
          tagk(b.box(ac, 'frame', 5, ht + 4, 4, dx, (ht + 4) / 2, dz + wd / 2 + 2, false), 'puerta');
          tagk(b.box(ac, 'frame', 5, 4, wd + 8, dx, ht + 2, dz, false), 'puerta');
          tagk(b.box(ac, 'steel', 5, 2, 10, dx + 2, 100, dz + wd / 2 - 10, false), 'puerta');
        }
      }
      function desk(dx, dz, w, d, chairSide) {
        b.box(ac, 'wood', w, 4, d, dx, 72, dz);
        b.box(ac, 'counter', 3, 70, d - 4, dx - w / 2 + 3, 35, dz, false);
        b.box(ac, 'counter', 3, 70, d - 4, dx + w / 2 - 3, 35, dz, false);
        var cz2 = dz + chairSide * (d / 2 + 30);
        b.box(ac, 'steel', 4, 40, 4, dx, 22, cz2, false);
        b.box(ac, 'counter', 46, 5, 46, dx, 44, cz2);
        b.box(ac, 'counter', 46, 40, 4, dx, 66, cz2 + chairSide * 21, false);
      }
      if (kind === 'local') {
        door(190, 16.4, true);
        b.box(ac, 'counter', 220, 88, 56, -150, 44, 130);
        b.box(ac, 'wood', 232, 5, 68, -150, 90.5, 130);
        [-210, -150, -90].forEach(function (lx) {
          b.box(ac, 'steel', 0.5, 36, 0.5, lx, Hh - 14 - 18, 130, false);
          b.box(ac, 'lamp', 14, 6, 14, lx, Hh - 14 - 39, 130, false);
        });
      } else {
        door(-250, 136.4, true);
        door(116.4, 185, false);
        desk(-250, -130, 150, 70, 1);
        desk(20, -150, 160, 70, 1);
        b.box(ac, 'counter', 90, 74, 56, 270, 37, 168);          // recepción: contra el tabique del fondo, bien adentro del ambiente
        b.box(ac, 'wood', 100, 4, 64, 270, 76, 168);
        [[-250, -130], [20, -150]].forEach(function (lp) {
          b.box(ac, 'steel', 0.5, 36, 0.5, lp[0], Hh - 14 - 18, lp[1], false);
          b.box(ac, 'lamp', 14, 6, 14, lp[0], Hh - 14 - 39, lp[1], false);
        });
      }
      // cielorraso completo sobre todo el local
      var ex2 = b.nm(b.layer(6, new V(0, 60, 0)), 'Cielorraso');
      var xa = -W / 2 + 24 + CWd, xw = W / 2 - xa;
      tagk(b.box(ex2, 'board', xw, 1.4, D - 18, xa + xw / 2, Hh - 14, 9), 'placa-cielo');
      var zb = -D / 2 + 24 + CDp, zw = D / 2 - zb;
      tagk(b.box(ex2, 'board', CWd + 6, 1.4, zw, -W / 2 + 18 + (CWd + 6) / 2, Hh - 14, zb + zw / 2), 'placa-cielo');
      b.paint = bd.mats.concat(ex2.mats);
      b.fin = ac;
    }
    return b;
  }

  // ---------------------------------------------------------------- visor
  function Viewer(THREE, container, cap, kind) {
    var self = this;
    this.T = THREE;
    this.container = container;
    this.kind = kind;
    this.cap = cap;
    this.tier = cap.tier;
    this.step = 1;
    this.model = null;
    this.models = {};
    this.az0 = 0.62; this.el0 = 0.3;
    this.az = this.az0; this.el = this.el0; this.zoom = 1;
    this.tAz = this.az; this.tEl = this.el; this.tZoom = 1; this.auto = false;
    this.pointers = {};
    this.dragging = false;
    this.rafId = 0;
    this.lastTime = 0;
    this.slow = 0;
    this.dead = false;
    this.canvas = container.querySelector('canvas.gl-canvas');
    var tier = this.tier;
    var small = container.clientWidth < 460;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'low-power'
    });
    // tope de densidad y de píxeles totales según el equipo; se recalcula cada vez que cambia el tamaño del visor
    this.dprCap = tier === 'low' ? 1 : 2;
    this.dprBudget = tier === 'high' ? 5000000 : tier === 'mid' ? 3200000 : 1400000;
    this.dpr = this.pickDpr(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.dpr);
    if (tier !== 'low') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    }
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.scene = new THREE.Scene();
    // modo de materiales: con reflejos y relieve en todos los equipos; solo los más básicos usan el modo liviano
    this.mode = tier === 'low' ? 'lite' : 'pbr';
    this.env = makeEnv(THREE, tier, this.mode);
    this.env.paperMap = this.env.tex('paper');
    this.env.onTex = function () { self.request(); };
    if (this.mode === 'pbr') {
      try { this.scene.environment = makeEnvMap(THREE, this.renderer); } catch (e) { /* sin reflejos */ }
    }
    this.capFps = small || tier !== 'high';        // en visores chicos o equipos medios, 30 cuadros por segundo alcanzan
    this.lastRender = 0;
    this.expK = 0;
    this.explode = false;
    this.visible = true;
    this.camera = new THREE.PerspectiveCamera(28, 1.5, 10, 6000);
    var hemi = new THREE.HemisphereLight(0xdde7f4, 0x6e6a64, this.mode === 'pbr' ? 0.3 : 0.8);
    this.scene.add(hemi);
    if (this.mode === 'pbr') {
      var fill = new THREE.DirectionalLight(0xbfd2f2, 0.35);       // luz de relleno del lado opuesto, sin sombra
      fill.position.set(520, 300, -480);
      this.scene.add(fill);
    }
    var sun = new THREE.DirectionalLight(0xfff1df, this.mode === 'pbr' ? 2.3 : 1.1);
    sun.position.set(-260, 820, 520);
    if (tier !== 'low') {
      sun.castShadow = true;
      var sz = tier === 'high' ? 1024 : 512;
      sun.shadow.mapSize.set(small ? 512 : sz, small ? 512 : sz);
      var c = sun.shadow.camera;
      c.left = -700; c.right = 700; c.top = 700; c.bottom = -700; c.near = 100; c.far = 2400;
      sun.shadow.bias = -0.0006;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.bindEvents();
    this.resize();
  }

  Viewer.prototype.setModel = function (key) {
    var T = this.T;
    this.hideTip();
    if (this.model) this.scene.remove(this.model.root);
    if (!this.models[key]) {
      this.models[key] = key === 'wall' ? buildWall(T, this.env) : key === 'panel' ? buildPanel(T, this.env) : key === 'ceiling' ? buildCeiling(T, this.env) : key === 'platea' ? buildPlatea(T, this.env) : key === 'custom' ? buildParam(T, this.env, window.NexoParam) : buildBuilding(T, this.env, key);
      var m = this.models[key];
      m.key = key;
      var gc = document.createElement('canvas'); gc.width = gc.height = 128;
      var gx = gc.getContext('2d'), gr = gx.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#e6e6e6'); gr.addColorStop(1, '#000000');
      gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
      var gmat = this.mode === 'pbr'
        ? new T.ShadowMaterial({ opacity: 0.32 })              // solo dibuja la sombra: sin disco claro ni bordes
        : new T.MeshBasicMaterial({ map: new T.CanvasTexture(gc), transparent: true, depthWrite: false, opacity: 0.07, color: 0xffffff });
      var gm = new T.Mesh(new T.CircleGeometry(1, 48), gmat);
      gm.receiveShadow = true;
      gm.rotation.x = -Math.PI / 2;
      m.ground = gm;
      // encuadre: se calcula con todas las capas a la vista
      m.layers.forEach(function (L) { L.g.visible = true; L.g.position.set(0, 0, 0); });
      if (m.floor) m.floorParent.remove(m.floor);
      var box = new T.Box3().setFromObject(m.root);
      if (m.floor) m.floorParent.add(m.floor);
      var size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
      m.bbox = box.clone();
      m.center = ctr; m.radius = Math.max(size.x, size.y * 1.25, size.z * 0.9) * 0.46;
      m.layers.forEach(function (L) { L.p = L.from === 0 ? 1 : 0; L.target = L.p; });
      var gr2 = Math.max(size.x, size.z) * (this.mode === 'pbr' ? 0.78 : 0.95);
      m.ground.scale.set(gr2, gr2, gr2);
      m.ground.position.set(ctr.x, m.groundY === undefined ? -0.2 : m.groundY, ctr.z);
      m.root.add(m.ground);
    }
    this.applyTheme();
    this.model = this.models[key];
    // la sombra del sol cubre todo el piso del modelo; si no, el borde de la zona con sombra se ve como una caja gris en el piso
    if (this.tier !== 'low' && this.model.bbox) {
      var mb = this.model.bbox, msz = mb.getSize(new T.Vector3()), mc = mb.getCenter(new T.Vector3());
      var R = Math.max(700, Math.max(msz.x, msz.z) * 1.15), scam = this.sun.shadow.camera;
      scam.left = -R; scam.right = R; scam.top = R; scam.bottom = -R; scam.near = 100; scam.far = 2400 + R;
      scam.updateProjectionMatrix();
      this.sun.target.position.set(mc.x, 0, mc.z);
      this.sun.position.set(mc.x - 260, 820, mc.z + 520);
      this.sun.target.updateMatrixWorld();
    }
    if (!this.model.lastStep) { var ls = 0; this.model.layers.forEach(function (L) { if (L.from > ls) ls = L.from; }); this.model.lastStep = ls; }
    this.az0 = this.model.az0 !== undefined ? this.model.az0 : 0.62;
    this.el0 = this.model.el0 !== undefined ? this.model.el0 : 0.3;
    this.az = this.az0; this.el = this.el0; this.zoom = 1;
    this.tAz = this.az; this.tEl = this.el; this.tZoom = 1;
    this.scene.add(this.model.root);
    this.applyAll();
    this.frameCamera();
    this.setStep(this.step, true);
    this.buildLayerPanel();
  };

  // ---------------------------------------------------------------- nombres de las piezas
  Viewer.prototype.pick = function (clientX, clientY) {
    var m = this.model;
    if (!m) return null;
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this.mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    var hits = this.raycaster.intersectObjects(m.root.children, true), i, o, ok, k;
    for (i = 0; i < hits.length; i++) {
      o = hits[i].object; ok = true; k = null;
      var tobj = null;
      while (o) {
        if (o.visible === false) { ok = false; break; }
        if (!k && o.userData && o.userData.k) { k = o.userData.k; tobj = o; }
        o = o.parent;
      }
      if (!ok) continue;
      return k && LABELS[k] ? { key: k, obj: tobj, inst: hits[i].instanceId } : null;     // lo primero que se ve: si no tiene nombre, no hay cartel
    }
    return null;
  };
  // dónde queda en pantalla la pieza que salió (para poner el cartel al lado de ella y no encima del lugar de origen)
  Viewer.prototype.hlScreen = function (fx, fy) {
    if (!this.hlVec) return { x: fx, y: fy };
    var p = this.hlCenter.clone().add(this.hlVec).project(this.camera), r = this.canvas.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height + 18 };
  };
  // con el mouse encima, el cursor pasa a la manito solo cuando hay una pieza con nombre debajo
  Viewer.prototype.hover = function (x, y) {
    var now = performance.now();
    if (this.tier === 'low' || now - (this.lastHover || 0) < 70) return;
    this.lastHover = now;
    var over = !!this.pick(x, y);
    if (over !== this.overPiece) { this.overPiece = over; this.canvas.style.cursor = over ? 'pointer' : ''; }
  };
  Viewer.prototype.tapTip = function (x, y, keep) {
    var self = this, hit = this.pick(x, y);
    clearTimeout(this.tipTimer);
    if (!hit) { this.hideTip(); return; }
    this.tipFx = x; this.tipFy = y;
    this.setHl(hit);
    var sp = this.hlScreen(x, y);
    this.showTip(hit.key, sp.x, sp.y);
    if (!keep) this.tipTimer = setTimeout(function () { self.hideTip(); }, 5000);   // con el mouse queda hasta el próximo click
  };
  Viewer.prototype.showTip = function (key, x, y) {
    var c = this.container, tip = this.tip;
    if (!tip) {
      tip = this.tip = document.createElement('div');
      tip.className = 'gl-tip';
      tip.setAttribute('aria-hidden', 'true');
      c.appendChild(tip);
    }
    if (this.tipKey !== key) {
      var lb = LABELS[key];
      tip.textContent = '';
      var t = document.createElement('strong'); t.textContent = lb[0];
      var d = document.createElement('span'); d.textContent = lb[1];
      tip.appendChild(t); tip.appendChild(d);
      this.tipKey = key;
    }
    tip.classList.add('is-on');
    var r = c.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var lx = x - r.left + 14, ly = y - r.top + 16;
    if (lx + w > r.width - 6) lx = x - r.left - w - 14;
    if (lx < 6) lx = 6;
    if (ly + h > r.height - 6) ly = y - r.top - h - 12;
    if (ly < 6) ly = 6;
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  };
  // al girar, el cartel acompaña a la pieza elegida
  Viewer.prototype.repositionTip = function () {
    var sp = this.hlScreen(this.tipFx, this.tipFy);
    this.showTip(this.tipKey, sp.x, sp.y);
  };
  Viewer.prototype.hideTip = function () {
    clearTimeout(this.tipTimer);
    if (this.tip) this.tip.classList.remove('is-on');
    this.tipKey = null;
    this.clearHl();
  };
  // la pieza que nombra el cartel se pinta de azul y una copia sale hacia quien mira, unida por una línea al lugar de donde salió
  Viewer.prototype.setHl = function (hit, extra) {
    var T = this.T, self = this;
    if (this.hlObj === hit.obj && this.hlInst === hit.inst) return;
    this.clearHl();
    this.hlObj = hit.obj; this.hlInst = hit.inst;
    if (!this.hlMat) {
      this.hlMat = new T.MeshBasicMaterial({ color: this.env.lin(0x2d7ff9), transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
      this.hlLiftMat = new T.MeshBasicMaterial({ color: this.env.lin(0x2d7ff9), transparent: true, opacity: 0.88, depthTest: false });
      this.hlLineMat = new T.LineBasicMaterial({ color: this.env.lin(0x2d7ff9), depthTest: false, transparent: true, opacity: 0.9 });
    }
    this.hl = [];
    this.model.root.updateMatrixWorld(true);
    function itemsOf(o, inst, out) {
      if (o.isInstancedMesh) {
        if (inst === undefined) return;
        var im = new T.Matrix4();
        o.getMatrixAt(inst, im);
        out.push([o.geometry, im.premultiply(o.matrixWorld)]);
      } else {
        o.traverse(function (c) { if (c.isMesh && !c.isInstancedMesh) out.push([c.geometry, c.matrixWorld.clone()]); });
      }
    }
    var items = [];
    if (hit.obj.isInstancedMesh && hit.inst === undefined) { this.hlObj = null; return; }
    itemsOf(hit.obj, hit.inst, items);
    // otras piezas del mismo tipo (al elegir desde la ficha): solo se pintan en su lugar
    (extra || []).forEach(function (q) {
      var more = [];
      itemsOf(q.obj, q.inst, more);
      more.forEach(function (it) {
        var m2 = new T.Mesh(it[0], self.hlMat);
        m2.matrixAutoUpdate = false; m2.matrix.copy(it[1]); m2.matrixWorldNeedsUpdate = true; m2.renderOrder = 5;
        self.scene.add(m2); self.hl.push(m2);
      });
    });
    var box = new T.Box3(), tmp = new T.Box3();
    items.forEach(function (it) {
      var g = it[0];
      if (!g.boundingBox) g.computeBoundingBox();
      tmp.copy(g.boundingBox).applyMatrix4(it[1]);
      box.union(tmp);
      var inPlace = new T.Mesh(g, self.hlMat);
      inPlace.matrixAutoUpdate = false; inPlace.matrix.copy(it[1]); inPlace.matrixWorldNeedsUpdate = true; inPlace.renderOrder = 5;
      self.scene.add(inPlace); self.hl.push(inPlace);
    });
    var size = box.getSize(new T.Vector3()), dm = [size.x, size.y, size.z].sort(function (p1, q1) { return q1 - p1; }), rr = this.model.radius * 0.9;
    var big = dm[0] * dm[1] > rr * rr;      // por la superficie y no por el largo: una solera larga y fina sí sale
    if (big) { this.request(); return; }      // las piezas muy grandes (platea, losas, paredes enteras) solo se pintan en su lugar: si salieran taparían el modelo
    items.forEach(function (it) {
      var lift = new T.Mesh(it[0], self.hlLiftMat);
      lift.matrixAutoUpdate = false; lift.matrix.copy(it[1]); lift.matrixWorldNeedsUpdate = true; lift.renderOrder = 9;
      lift.userData.base = it[1];
      self.scene.add(lift); self.hl.push(lift);
    });
    var center = box.getCenter(new T.Vector3());
    var maxd = Math.max(size.x, size.y, size.z);
    var dist = Math.max(26, Math.min(this.model.radius * 0.24, maxd * 0.9));
    this.hlVec = this.camera.position.clone().sub(center).normalize().multiplyScalar(dist);
    this.hlCenter = center;
    var lg = new T.BufferGeometry().setFromPoints([center.clone(), center.clone()]);
    this.hlLine = new T.Line(lg, this.hlLineMat);
    this.hlLine.frustumCulled = false;
    this.hlLine.renderOrder = 8;
    this.scene.add(this.hlLine);
    this.hlDot = new T.Mesh(new T.SphereGeometry(Math.max(3, this.model.radius * 0.014), 12, 8), this.hlLiftMat);
    this.hlDot.position.copy(center);
    this.hlDot.renderOrder = 8;
    this.scene.add(this.hlDot);
    this.hlT0 = performance.now();
    this.hlK = 0;
    this.stepHl(this.hlT0);
    this.request();
  };
  // anima la salida de la pieza (0,25 s); devuelve true mientras se mueve
  Viewer.prototype.stepHl = function (now) {
    if (!this.hl || !this.hlVec) return false;
    var k = this.cap.reduce ? 1 : Math.min(1, (now - this.hlT0) / 250);
    if (k === this.hlK && k >= 1) return false;
    this.hlK = k;
    var e = 1 - Math.pow(1 - k, 3), T = this.T, v = this.hlVec, c = this.hlCenter, sc = 1 + 0.08 * e;
    var tr = new T.Matrix4().makeTranslation(v.x * e + c.x, v.y * e + c.y, v.z * e + c.z).multiply(new T.Matrix4().makeScale(sc, sc, sc)).multiply(new T.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    this.hl.forEach(function (h) {
      if (h.userData.base) { h.matrix.copy(h.userData.base).premultiply(tr); h.matrixWorldNeedsUpdate = true; }
    });
    var pos = this.hlLine.geometry.attributes.position;
    pos.setXYZ(1, this.hlCenter.x + v.x * e, this.hlCenter.y + v.y * e, this.hlCenter.z + v.z * e);
    pos.needsUpdate = true;
    return k < 1;
  };
  Viewer.prototype.clearHl = function () {
    if (!this.hl) return;
    var self = this;
    this.hl.forEach(function (h) { self.scene.remove(h); });
    if (this.hlLine) { this.scene.remove(this.hlLine); this.hlLine.geometry.dispose(); this.hlLine = null; }
    if (this.hlDot) { this.scene.remove(this.hlDot); this.hlDot.geometry.dispose(); this.hlDot = null; }
    this.hl = null; this.hlObj = null; this.hlInst = undefined; this.hlVec = null;
    this.fsSel = null;
    this.markFsSel();
    this.request();
  };

  // ---------------------------------------------------------------- capas: elegir qué se ve
  Viewer.prototype.layerGroups = function () {
    var out = [], idx = {};
    this.model.layers.forEach(function (L) {
      if (!L.name || L.from === 0) return;
      if (idx[L.name] === undefined) { idx[L.name] = out.length; out.push({ name: L.name, layers: [] }); }
      out[idx[L.name]].layers.push(L);
    });
    return out;
  };
  Viewer.prototype.buildLayerPanel = function () {
    var self = this, c = this.container, tools = c.querySelector('.gl-tools');
    if (!tools || !this.model) return;
    if (!this.layerBtn) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.setAttribute('aria-label', 'Capas: elegir qué se ve');
      bt.setAttribute('aria-expanded', 'false');
      bt.dataset.act = 'layers';
      bt.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4"/></svg>';
      bt.addEventListener('click', function (e) { e.stopPropagation(); self.toggleLayers(); });
      tools.appendChild(bt);
      this.layerBtn = bt;
      if (this.box) {
        var fb = document.createElement('button');
        fb.type = 'button';
        fb.setAttribute('aria-label', 'Pantalla completa, con la ficha de cada paso');
        fb.dataset.act = 'fs';
        fb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
        fb.addEventListener('click', function (e) { e.stopPropagation(); self.enterFs(); });
        tools.appendChild(fb);
      }
      var xb = document.createElement('button');
      xb.type = 'button';
      xb.setAttribute('aria-label', 'Separar las capas');
      xb.setAttribute('aria-pressed', 'false');
      xb.dataset.act = 'explode';
      xb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v4M9.7 4.8L12 2.5l2.3 2.3M12 21.5v-4M9.7 19.2l2.3 2.3 2.3-2.3M4.5 10h15v4h-15z"/></svg>';
      xb.addEventListener('click', function (e) { e.stopPropagation(); self.toggleExplode(); });
      tools.appendChild(xb);
      this.explodeBtn = xb;
      var pn = document.createElement('div');
      pn.className = 'gl-layers';
      pn.hidden = true;
      pn.setAttribute('role', 'group');
      pn.setAttribute('aria-label', 'Capas del modelo');
      pn.addEventListener('keydown', function (e) { if (e.key === 'Escape') { self.closeLayers(); self.layerBtn.focus(); } });
      c.appendChild(pn);
      this.layerPanel = pn;
    }
    this.closeLayers();
    var panel = this.layerPanel, boxes = [];
    panel.textContent = '';
    var title = document.createElement('p');
    title.className = 'gl-layers-title';
    title.textContent = 'Qué se ve';
    panel.appendChild(title);
    this.layerGroups().forEach(function (g) {
      var lab = document.createElement('label'), cb = document.createElement('input'), tx = document.createElement('span');
      lab.className = 'gl-layer';
      cb.type = 'checkbox';
      cb.checked = !g.layers[0].hidden;
      tx.textContent = g.name;
      cb.addEventListener('change', function () {
        g.layers.forEach(function (L) { L.hidden = !cb.checked; });
        self.applyAll();
        self.request();
      });
      lab.appendChild(cb); lab.appendChild(tx);
      panel.appendChild(lab);
      boxes.push([cb, g]);
    });
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'gl-layers-all';
    all.textContent = 'Mostrar todas';
    all.addEventListener('click', function () {
      boxes.forEach(function (q) { q[0].checked = true; q[1].layers.forEach(function (L) { L.hidden = false; }); });
      self.applyAll();
      self.request();
    });
    panel.appendChild(all);
    this.refreshLayerPanel();
  };
  Viewer.prototype.refreshLayerPanel = function () {
    if (!this.layerPanel || !this.model) return;
    var step = this.step, items = this.layerPanel.querySelectorAll('.gl-layer');
    this.layerGroups().forEach(function (g, i) {
      if (items[i]) items[i].classList.toggle('is-later', g.layers.every(function (L) { return step < L.from; }));
    });
  };
  Viewer.prototype.toggleExplode = function () {
    this.explode = !this.explode;
    this.hideTip();
    if (this.explode) { this.zoomBeforeExp = this.tZoom; this.tZoom = Math.min(this.tZoom, 0.8); }
    else { this.tZoom = this.zoomBeforeExp || 1; }
    if (this.explodeBtn) {
      this.explodeBtn.setAttribute('aria-pressed', String(this.explode));
      this.explodeBtn.classList.toggle('is-on', this.explode);
    }
    this.request();
  };
  Viewer.prototype.toggleLayers = function () {
    if (!this.layerPanel) return;
    var open = this.layerPanel.hidden;
    this.layerPanel.hidden = !open;
    this.layerBtn.setAttribute('aria-expanded', String(open));
    this.layerBtn.classList.toggle('is-on', open);
    this.hideTip();
  };
  Viewer.prototype.closeLayers = function () {
    if (!this.layerPanel || this.layerPanel.hidden) return;
    this.layerPanel.hidden = true;
    this.layerBtn.setAttribute('aria-expanded', 'false');
    this.layerBtn.classList.remove('is-on');
  };


  // ---------------------------------------------------------------- pantalla completa con la ficha del paso
  // elegir una pieza desde la ficha: todas las de ese tipo se pintan en su lugar y una de ellas sale hacia quien mira
  Viewer.prototype.selectKey = function (key) {
    if (!this.model) return;
    if (this.fsSel === key) { this.hideTip(); return; }
    var list = [];
    this.model.root.updateMatrixWorld(true);
    this.model.root.traverse(function (o) {
      if (!(o.userData && o.userData.k === key)) return;
      for (var q = o; q; q = q.parent) if (q.visible === false) return;
      if (o.isInstancedMesh) { for (var i = 0; i < o.count; i++) list.push({ obj: o, inst: i }); } else list.push({ obj: o });
    });
    if (!list.length) return;
    this.hideTip();
    this.tipFx = 0; this.tipFy = 0;
    this.setHl(list[0], list.slice(1));
    this.fsSel = key;
    this.markFsSel();
  };
  Viewer.prototype.markFsSel = function () {
    if (!this.fsParts) return;
    var sel = this.fsSel, items = this.fsParts.querySelectorAll('button');
    Array.prototype.forEach.call(items, function (b) { var on = b.dataset.key === sel; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  Viewer.prototype.stepEls = function () {
    if (!this.box) return [];
    var list = this.box.querySelectorAll('ol.build-steps:not([hidden]) .build-step');
    return list.length ? Array.prototype.slice.call(list) : Array.prototype.slice.call(this.box.querySelectorAll('.build-step'));
  };
  Viewer.prototype.buildFs = function () {
    if (this.fsEl) return;
    var self = this, c = this.container;
    function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
    var top = mk('div', 'gl-fs-top');
    this.fsTitle = mk('span', 'gl-fs-title');
    var close = mk('button', 'gl-fs-close', 'Cerrar');
    close.type = 'button';
    close.setAttribute('aria-label', 'Salir de pantalla completa');
    close.addEventListener('click', function () { self.exitFs(); });
    top.appendChild(this.fsTitle); top.appendChild(close);
    var panel = mk('aside', 'gl-fs-panel');
    panel.setAttribute('aria-label', 'Ficha del paso');
    var nav = mk('div', 'gl-fs-nav');
    this.fsPrev = mk('button', 'gl-fs-btn', 'Anterior'); this.fsPrev.type = 'button';
    this.fsNext = mk('button', 'gl-fs-btn', 'Siguiente'); this.fsNext.type = 'button';
    this.fsCount = mk('span', 'gl-fs-count');
    this.fsCount.setAttribute('aria-live', 'polite');
    this.fsPrev.addEventListener('click', function () { self.fsGo(-1); });
    this.fsNext.addEventListener('click', function () { self.fsGo(1); });
    nav.appendChild(this.fsPrev); nav.appendChild(this.fsCount); nav.appendChild(this.fsNext);
    var fold = mk('button', 'gl-fs-fold', 'Ficha del paso');
    fold.type = 'button';
    fold.setAttribute('aria-expanded', 'false');
    fold.addEventListener('click', function () {
      var open = c.classList.toggle('fs-open');
      fold.setAttribute('aria-expanded', String(open));
      self.resize();
    });
    this.fsFold = fold;
    var body = mk('div', 'gl-fs-body');
    this.fsStep = mk('h3', 'gl-fs-step');
    this.fsText = mk('p', 'gl-fs-text');
    this.fsPartsTitle = mk('h4', 'gl-fs-sub', 'Piezas que se agregan en este paso. Tocá una para verla en el modelo');
    this.fsParts = mk('ul', 'gl-fs-parts');
    body.appendChild(this.fsStep); body.appendChild(this.fsText); body.appendChild(this.fsPartsTitle); body.appendChild(this.fsParts);
    panel.appendChild(nav); panel.appendChild(fold); panel.appendChild(body);
    c.appendChild(top); c.appendChild(panel);
    this.fsEl = top;
    this.fsKey = function (e) { if (e.key === 'Escape') self.exitFs(); };
    document.addEventListener('fullscreenchange', function () {
      if (self.fs && self.nativeFs && !document.fullscreenElement) self.exitFs();
    });
  };
  Viewer.prototype.fsGo = function (delta) {
    var n = this.step + delta, count = this.stepEls().length || (this.model && this.model.lastStep) || 1;
    if (n < 1 || n > count || !this.box) return;
    this.box.dispatchEvent(new CustomEvent('nexo-goto', { detail: n }));
  };
  Viewer.prototype.refreshFs = function () {
    if (!this.fs || !this.model) return;
    var step = this.step, els = this.stepEls(), count = els.length || this.model.lastStep || 1, cur = null, i;
    for (i = 0; i < els.length; i++) if (Number(els[i].dataset.step) === step) cur = els[i];
    var tt = cur && cur.querySelector('.build-step-title, .step-title'), tx = cur && cur.querySelector('.build-step-text, .reason-text');
    this.fsStep.textContent = tt ? tt.textContent : '';
    this.fsText.textContent = tx ? tx.textContent : '';
    this.fsCount.textContent = 'Paso ' + step + ' de ' + count;
    this.fsPrev.disabled = step <= 1;
    this.fsNext.disabled = step >= count;
    var seen = {}, keys = [];
    this.model.layers.forEach(function (L) {
      if (L.from !== step || L.from === 0) return;
      L.g.traverse(function (o) {
        var k = o.userData && o.userData.k;
        if (k && LABELS[k] && !seen[k]) { seen[k] = 1; keys.push(k); }
      });
    });
    this.fsParts.textContent = '';
    var selfv = this;
    keys.forEach(function (k) {
      var li = document.createElement('li'), bt = document.createElement('button'), a = document.createElement('strong'), b = document.createElement('span');
      bt.type = 'button';
      bt.dataset.key = k;
      bt.setAttribute('aria-pressed', 'false');
      bt.setAttribute('aria-label', LABELS[k][0] + ': marcar en el modelo');
      a.textContent = LABELS[k][0]; b.textContent = LABELS[k][1];
      bt.appendChild(a); bt.appendChild(b);
      bt.addEventListener('click', function () { selfv.selectKey(k); });
      li.appendChild(bt);
      this.fsParts.appendChild(li);
    }, this);
    this.markFsSel();
    this.fsPartsTitle.hidden = !keys.length;
    var h2 = this.box && this.box.closest('section') && this.box.closest('section').querySelector('h2');
    var tab = this.box && this.box.querySelector('.type-tab.is-active');
    this.fsTitle.textContent = (h2 ? h2.textContent : '') + (tab ? ': ' + tab.textContent : '');
  };
  Viewer.prototype.enterFs = function () {
    if (this.fs || !this.model) return;
    var self = this, c = this.container;
    this.buildFs();
    this.closeLayers();
    this.hideTip();
    this.fs = true;
    c.classList.add('is-fs');
    document.documentElement.classList.add('gl-fs-lock');
    this.canvas.style.touchAction = 'none';
    document.addEventListener('keydown', this.fsKey);
    if (this.box) this.box.dispatchEvent(new CustomEvent('nexo-fs', { detail: true }));
    // en celular no se usa la pantalla completa del navegador (la cámara y la barra de estado tapan los botones): la página se ve a pantalla completa por su cuenta
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (c.requestFullscreen && !touch) {
      try { var pr = c.requestFullscreen(); if (pr && pr.then) pr.then(function () { self.nativeFs = true; }, function () { /* queda a pantalla completa de la página */ }); } catch (e) { /* nada */ }
    }
    this.refreshFs();
    this.resize();
    requestAnimationFrame(function () { self.resize(); });
    setTimeout(function () { self.resize(); }, 250);
  };
  Viewer.prototype.exitFs = function () {
    if (!this.fs) return;
    var self = this, c = this.container;
    this.fs = false;
    c.classList.remove('is-fs', 'fs-open');
    if (this.fsFold) this.fsFold.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('gl-fs-lock');
    this.canvas.style.touchAction = 'pan-y';
    document.removeEventListener('keydown', this.fsKey);
    if (this.box) this.box.dispatchEvent(new CustomEvent('nexo-fs', { detail: false }));
    if (this.nativeFs && document.fullscreenElement === c && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) { /* nada */ } }
    this.nativeFs = false;
    this.resize();
    requestAnimationFrame(function () { self.resize(); });
    setTimeout(function () { self.resize(); }, 250);
  };

  Viewer.prototype.reloadCustom = function () {
    if (!this.model) return;
    var az = this.tAz, el = this.tEl, zm = this.tZoom, self = this;
    this.hideTip();
    delete this.models.custom;
    this.setModel('custom');
    this.az = this.tAz = az; this.el = this.tEl = el; this.zoom = this.tZoom = zm;
    this.setStep(this.model.lastStep || 99, true);
    this.refreshLayerPanel();
    this.request();
  };
  Viewer.prototype.frameCamera = function () {
    var m = this.model;
    if (!m) return;
    var fov = this.camera.fov * Math.PI / 180;
    var aspect = this.camera.aspect;
    var fit = m.radius / Math.sin(Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * aspect)));
    this.dist = fit * (aspect < 1 ? 1.34 : aspect < 1.4 ? 1.12 : 1.02);   // primera aproximación
    // ajuste fino: se aleja o se acerca hasta que las esquinas del modelo entran justo en el cuadro, sea cual sea su forma
    // los botones del visor van encima del dibujo, a la derecha: el modelo se centra en el lugar que queda libre
    var cw = this.canvas.clientWidth || this.container.clientWidth, ch = this.canvas.clientHeight || this.container.clientHeight, padR = 0, tl = this.container.querySelector('.gl-tools');
    if (tl && tl.offsetParent && !this.fs && cw > 0) {
      var cr = this.canvas.getBoundingClientRect(), tr = tl.getBoundingClientRect();
      if (tr.left > cr.left + cr.width * 0.5 && tr.top < cr.bottom && tr.bottom > cr.top) padR = Math.max(0, cr.right - tr.left + 8);
    }
    if (padR > 0 && padR < cw * 0.4) this.camera.setViewOffset(cw, ch, padR / 2, 0, cw, ch); else { padR = 0; this.camera.clearViewOffset(); }
    var cxo = cw ? padR / cw : 0;
    if (m.bbox) {
      var T = this.T, self = this, b = m.bbox, pts = [], i, k, z0 = this.zoom, v = new T.Vector3();
      for (i = 0; i < 8; i++) pts.push(new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      this.zoom = 1;
      for (k = 0; k < 4; k++) {
        this.updateCamera();
        this.camera.updateMatrixWorld();
        var mx = 0;
        pts.forEach(function (q) { v.copy(q).project(self.camera); mx = Math.max(mx, Math.abs(v.x + cxo) / (1 - cxo), Math.abs(v.y)); });
        if (mx < 0.001) break;
        this.dist *= mx / 0.9;
      }
      this.zoom = z0;
    }
    this.updateCamera();
  };

  Viewer.prototype.updateCamera = function () {
    var m = this.model, c = m.center;
    var r = this.dist / this.zoom, az = this.az, el = this.el;
    this.camera.position.set(c.x + r * Math.sin(az) * Math.cos(el), c.y * 0.9 + r * Math.sin(el), c.z + r * Math.cos(az) * Math.cos(el));
    this.camera.lookAt(c.x, c.y * 0.85, c.z);
    this.camera.updateProjectionMatrix();
  };

  Viewer.prototype.pickDpr = function (w, h) {
    var d = Math.min(window.devicePixelRatio || 1, this.dprCap);
    d = Math.min(d, Math.sqrt(this.dprBudget / Math.max(1, w * h)));
    return Math.max(1, d);
  };

  Viewer.prototype.resize = function () {
    // el tamaño es el del lienzo (en celular deja una franja libre para los botones)
    var w = this.canvas.clientWidth || this.container.clientWidth, h = this.canvas.clientHeight || this.container.clientHeight;
    if (!w || !h) return;
    var nd = this.pickDpr(w, h);
    if (Math.abs(nd - this.dpr) > 0.01) { this.dpr = nd; this.renderer.setPixelRatio(nd); }
    // sombras más definidas cuando el visor es grande
    if (this.sun && this.sun.castShadow) {
      var want = this.tier === 'high' ? (w >= 700 ? 2048 : 1024) : (w >= 700 ? 1024 : 512);
      if (this.sun.shadow.mapSize.x !== want) {
        this.sun.shadow.mapSize.set(want, want);
        if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      }
    }
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frameCamera();
    this.request();
  };

  Viewer.prototype.setStep = function (n, instant) {
    var self = this;
    if (this.explode && !instant) this.toggleExplode();      // al cambiar de paso, la obra se ve armada
    this.step = n;
    this.hideTip();
    var m = this.model;
    if (!m) return;
    m.layers.forEach(function (L) {
      L.target = (L.from === 0 || n >= L.from) ? 1 : 0;
      var hi = !self.noHi && L.hi !== 0 && n === L.hi && n < (m.lastStep || 99);
      L.mats.forEach(function (mat) {
        if (mat.emissive) {
          if (mat.userData.e0 === undefined) mat.userData.e0 = mat.emissive.clone();
          mat.emissive.copy(hi ? self.env.lin(0x260a0f) : mat.userData.e0);
        }
      });
      if (instant) L.p = L.target;
    });
    // terminación: todas las piezas pintadas toman el mismo color y la misma textura fina
    if (m.paint && m.fin) {
      var done = n >= m.fin.from, house = m.key === 'vivienda' || m.key === 'ampliacion';
      m.paint.forEach(function (mat) {
        if (mat.userData.map0 === undefined) mat.userData.map0 = mat.map || null;
        var want = done ? (self.env.paperMapReal || self.env.paperMap) : mat.userData.map0;
        if (mat.map !== want) { mat.map = want; mat.needsUpdate = true; }
        mat.color.copy(self.env.lin(done ? (house ? 0xe3dac7 : 0xe4e1d8) : (house ? 0xcaa56d : 0xd3ccbb)));
      });
    }
    this.applyAll();
    this.refreshLayerPanel();
    this.refreshFs();
    this.request();
  };

  Viewer.prototype.applyAll = function () {
    var m = this.model;
    if (!m) return;
    var moving = false, xk = this.expK || 0;
    m.layers.forEach(function (L) {
      var e = 1 - Math.pow(1 - L.p, 3);
      var f = (1 - e) + xk * 1.3 * e;       // vista explosionada: cada capa se aleja hacia el lado del que llega al armarse
      L.g.position.set(L.off.x * f, L.off.y * f, L.off.z * f);
      L.g.visible = L.p > 0.003 && !L.hidden;
      if (L.p !== L.target) moving = true;
    });
    return moving;
  };

  Viewer.prototype.request = function () {
    if (this.dead || this.rafId) return;
    var self = this;
    this.rafId = requestAnimationFrame(function (t) { self.tick(t); });
  };

  Viewer.prototype.tick = function (now) {
    this.rafId = 0;
    if (this.dead) return;
    if (!this.visible) { this.lastTime = 0; return; }   // fuera de pantalla no se dibuja
    if (this.capFps && !Object.keys(this.pointers).length && this.lastRender && now - this.lastRender < 30) { this.request(); return; }
    this.lastRender = now;
    var dt = this.lastTime ? Math.min(now - this.lastTime, 100) : 16;
    this.lastTime = now;
    var m = this.model, moving = false;
    if (m) {
      var speed = this.cap.reduce ? 10 : dt / 900;
      m.layers.forEach(function (L) {
        if (L.p < L.target) { L.p = Math.min(L.target, L.p + speed); moving = true; }
        else if (L.p > L.target) { L.p = Math.max(L.target, L.p - speed * 1.4); moving = true; }
      });
      if (this.auto && !Object.keys(this.pointers).length && !this.cap.reduce) this.tAz -= dt * 0.00045;
      var kk = this.cap.reduce ? 1 : 1 - Math.exp(-dt / 85);
      this.az += (this.tAz - this.az) * kk;
      this.el += (this.tEl - this.el) * kk;
      this.zoom += (this.tZoom - this.zoom) * kk;
      if (Math.abs(this.tAz - this.az) > 0.0006 || Math.abs(this.tEl - this.el) > 0.0006 || Math.abs(this.tZoom - this.zoom) > 0.0006 || (this.auto && !this.cap.reduce)) moving = true;
      var et = this.explode ? 1 : 0;
      if (this.expK !== et) {
        this.expK = this.cap.reduce ? et : this.expK + (et - this.expK) * Math.min(1, dt / 150);
        if (Math.abs(et - this.expK) < 0.004) this.expK = et;
        moving = true;
      }
      this.applyAll();
      if (this.stepHl(now)) moving = true;
      this.updateCamera();
      this.renderer.render(this.scene, this.camera);
      if (this.tipKey && this.tip && this.tip.classList.contains('is-on')) this.repositionTip();
    }
    // si el equipo no da abasto: se baja la calidad y, si sigue lento, se vuelve a los dibujos
    if (moving) {
      if (dt > 38) this.slow++; else this.slow = Math.max(0, this.slow - 1);
      if (this.slow > 10) { this.degrade(); this.slow = 0; }
      this.request();
    } else {
      this.lastTime = 0;
    }
  };

  Viewer.prototype.degrade = function () {
    if (this.tier !== 'low') {
      this.tier = 'low';
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      this.dprCap = Math.min(this.dprCap, 1.25);
      this.dprBudget = Math.min(this.dprBudget, 1400000);
      this.dpr = this.pickDpr(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
      this.renderer.setPixelRatio(this.dpr);
      this.resize();
      this.scene.traverse(function (o) { if (o.material) { var ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (x) { x.needsUpdate = true; }); } });
    } else if (this.slowFail) {
      this.slowFail();
    } else {
      this.fail();
    }
  };

  Viewer.prototype.bindEvents = function () {
    var self = this, canvas = this.canvas;
    canvas.removeAttribute('aria-hidden');
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Modelo 3D de la obra. Con las flechas del teclado se gira, con más y menos se acerca o se aleja, y con cero se reinicia la vista.');
    this.box = this.container.closest('[data-build], [data-play]');
    canvas.style.touchAction = 'pan-y';   // en la página, el deslizar vertical sigue desplazando la pagina; en pantalla completa pasa a 'none'

    function count() { return Object.keys(self.pointers).length; }
    function dist2() {
      var k = Object.keys(self.pointers), a = self.pointers[k[0]], b = self.pointers[k[1]];
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) || 1;
    }
    canvas.addEventListener('pointerdown', function (e) {
      self.pointers[e.pointerId] = { x: e.clientX, y: e.clientY, type: e.pointerType, btn: e.button, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
      self.closeLayers();     // la pieza elegida sigue marcada mientras se gira
      if (e.pointerType === 'mouse' && e.button === 2) canvas.style.cursor = 'grabbing';   // girando: manito cerrada, como para mover
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
      if (count() === 2) { self.pinchStart = dist2(); self.pinchZoom = self.tZoom; }
      self.userMoved = true;
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = self.pointers[e.pointerId];
      if (!p) { if (e.pointerType === 'mouse') self.hover(e.clientX, e.clientY); return; }
      if (Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 8) p.moved = true;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (p.type === 'mouse' && p.btn !== 2) return;     // con el mouse, el click izquierdo elige una pieza y el derecho gira
      if (count() >= 2) {
        self.tZoom = Math.max(0.6, Math.min(2.8, self.pinchZoom * dist2() / self.pinchStart));
      } else {
        self.tAz -= dx * 0.0075;
        if (p.type !== 'touch' || self.fs) self.tEl = Math.max(-0.6, Math.min(1.5, self.tEl + dy * 0.006));
      }
      self.request();
    });
    function end(e) { delete self.pointers[e.pointerId]; canvas.style.cursor = ''; self.overPiece = false; }
    canvas.addEventListener('pointerup', function (e) {
      var p = self.pointers[e.pointerId];
      if (p && !p.moved && count() === 1 && performance.now() - p.t < 450 && (e.pointerType !== 'mouse' || p.btn === 0)) self.tapTip(e.clientX, e.clientY, e.pointerType === 'mouse');
      end(e);
    });
    canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !Object.keys(self.pointers).length) { canvas.style.cursor = ''; self.overPiece = false; } });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // el click derecho es para girar
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('dblclick', function () { self.resetView(); });
    // la rueda solo acerca con Ctrl (o con el gesto de pellizco del trackpad), para no trabar el scroll de la página
    canvas.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey || self.fs || document.activeElement === canvas)) return;
      e.preventDefault();
      self.zoomBy(Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') self.tAz += 0.2;
      else if (k === 'ArrowRight') self.tAz -= 0.2;
      else if (k === 'ArrowUp') self.tilt(0.1);
      else if (k === 'ArrowDown') self.tilt(-0.1);
      else if (k === '+' || k === '=') self.zoomBy(1.15);
      else if (k === '-' || k === '_') self.zoomBy(1 / 1.15);
      else if (k === '0') self.resetView();
      else used = false;
      if (used) { e.preventDefault(); self.request(); }
    });
    // botones de la vista
    var tools = this.container.querySelectorAll('.gl-tools button');
    Array.prototype.forEach.call(tools, function (bt) {
      bt.addEventListener('click', function () {
        var act = bt.dataset.act;
        if (act === 'up') self.tilt(0.18);
        else if (act === 'down') self.tilt(-0.18);
        else if (act === 'in') self.zoomBy(1.2);
        else if (act === 'out') self.zoomBy(1 / 1.2);
        else if (act === 'left') self.tAz += 0.5;
        else if (act === 'right') self.tAz -= 0.5;
        else if (act === 'auto') {
          self.auto = !self.auto;
          bt.setAttribute('aria-pressed', String(self.auto));
          bt.classList.toggle('is-on', self.auto);
        }
        else if (act === 'reset') { self.auto = false; self.resetView(); }
        self.request();
      });
    });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.fail(); });
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () {
        if (self.rzPending) return;
        self.rzPending = true;
        requestAnimationFrame(function () { self.rzPending = false; self.resize(); });
      });
      this.ro.observe(this.container);
    }
    // el piso de apoyo cambia con el modo claro u oscuro
    if (window.MutationObserver) {
      this.mo = new MutationObserver(function () { self.applyTheme(); });
      this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  };

  Viewer.prototype.tilt = function (d) { this.tEl = Math.max(-0.6, Math.min(1.5, this.tEl + d)); };
  Viewer.prototype.zoomBy = function (f) { this.tZoom = Math.max(0.6, Math.min(2.8, this.tZoom * f)); this.request(); };
  Viewer.prototype.resetView = function () {
    // vuelve por el camino más corto
    var turn = Math.round((this.tAz - this.az0) / (Math.PI * 2));
    this.tAz = this.az0 + turn * Math.PI * 2; this.tEl = this.el0; this.tZoom = 1;
    this.request();
  };

  // Piso de apoyo: un disco suave que toma el color según el tema
  Viewer.prototype.applyTheme = function () {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var self = this;
    Object.keys(this.models).forEach(function (k) {
      var m = self.models[k];
      if (m.ground && self.mode !== 'pbr') {
        m.ground.material.color.setHex(light ? 0x1b1c1e : 0xffffff);
        m.ground.material.opacity = light ? 0.1 : 0.07;
      }
      if (m.floor) m.floor.material.opacity = light ? 0.2 : 0.16;
    });
    this.request();
  };

  Viewer.prototype.fail = function () {
    this.destroy();
    this.container.classList.remove('gl-ready');
    this.container.classList.add('gl-failed');
  };

  Viewer.prototype.destroy = function () {
    this.dead = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.ro) this.ro.disconnect();
    if (this.mo) this.mo.disconnect();
    try { this.renderer.dispose(); if (this.renderer.forceContextLoss) this.renderer.forceContextLoss(); } catch (e) { /* nada */ }
  };

  // ---------------------------------------------------------------- integración con la página
  function getPref() { try { return window.sessionStorage.getItem('nexo-view') || ''; } catch (e) { return ''; } }
  function setPref(v) { try { window.sessionStorage.setItem('nexo-view', v); } catch (e) { /* nada */ } }

  // Cola de creación: un visor por vez y en un momento libre del navegador, para no trabar la página
  var queue = [], queueBusy = false;
  function enqueue(job) { queue.push(job); pump(); }
  function pump() {
    if (queueBusy || !queue.length) return;
    queueBusy = true;
    var job = queue.shift();
    var run = function () {
      var finished = false;
      var done = function () { if (finished) return; finished = true; queueBusy = false; setTimeout(pump, 160); };
      try { job(done); } catch (e) { done(); }
      setTimeout(done, 4000);   // seguro: si algo no avisa, la fila sigue
    };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 700 }); else setTimeout(run, 60);
  }

  function mount(container) {
    if (container.dataset.glState) return;
    var cap = capability();
    if (cap.off || !webglOk()) { container.dataset.glState = 'off'; container.classList.add('gl-failed'); return; }
    container.dataset.glState = 'wait';
    container.classList.add('gl-can');                 // hay 3D disponible: se muestra el selector 3D / 2D
    var box = container.closest('[data-build], [data-play]');
    var kind = container.dataset.gl;
    var loopN = Number(container.dataset.glLoop) || 0;
    var fixed = Number(container.dataset.glStatic) || 0;
    var started = false, viewer = null, inRange = false, visible = false, timers = [], hooks = [];
    var buttons = Array.prototype.slice.call(container.querySelectorAll('.gl-switch button'));

    function is2d() { return container.classList.contains('view-2d'); }
    function paintSwitch() {
      var v2 = is2d();
      buttons.forEach(function (bt) {
        var on = (bt.dataset.view === '2d') === v2;
        bt.classList.toggle('is-active', on);
        bt.setAttribute('aria-pressed', String(on));
      });
    }
    function setView(v) {
      if (v === '2d' && viewer && !viewer.dead) { /* queda cargado pero sin dibujar */ }
      container.classList.toggle('view-2d', v === '2d');
      setPref(v);
      paintSwitch();
      if (v === '3d') {
        if (!started) { if (inRange) start(); }
        else if (viewer && !viewer.dead) { viewer.resize(); viewer.request(); }
      }
    }
    buttons.forEach(function (bt) { bt.addEventListener('click', function () { setView(bt.dataset.view); }); });
    container.__setView = setView;
    if (getPref() === '2d') container.classList.add('view-2d');
    paintSwitch();

    function activeNow() {
      return visible && !document.hidden && !is2d() && (!container.classList.contains('scene-item') || container.classList.contains('is-on'));
    }
    function startLoop() {
      var step = 1;
      function tick() {
        if (!viewer || viewer.dead) return;
        if (!activeNow()) { timers.push(setTimeout(tick, 800)); return; }
        step = step >= loopN ? 1 : step + 1;
        viewer.setStep(step);
        timers.push(setTimeout(tick, step >= loopN ? 6500 : 2600));
      }
      timers.push(setTimeout(tick, 2600 + Math.floor(Math.random() * 1800)));   // los ciclos no arrancan todos juntos
    }
    function on(target, type, fn) { target.addEventListener(type, fn); hooks.push([target, type, fn]); }

    function start() {
      if (started) return;
      started = true;
      enqueue(function (done) {
        if (!started) { done(); return; }
        loadThree().then(function (THREE) {
          if (!started) { done(); return; }
          var T0 = performance.now();
          try { viewer = new Viewer(THREE, container, cap, kind); }
          catch (err) { started = false; container.classList.add('gl-failed'); container.dataset.glState = 'off'; done(); return; }
          instances.push(viewer);
          container.__gl = viewer;
          viewer.visible = visible;
          viewer.slowFail = function () {      // si el equipo no puede, todos los visores pasan a 2D
            setPref('2d');
            Array.prototype.forEach.call(document.querySelectorAll('[data-gl]'), function (c) { if (c.__setView) c.__setView('2d'); });
          };
          container.dataset.glState = 'on';
          var key = kind === 'wall' || kind === 'panel' || kind === 'ceiling' || kind === 'platea' || kind === 'custom' ? kind : ((box && box.dataset.type) || 'vivienda');
          viewer.noHi = !!(fixed || (loopN && !box));
          viewer.step = fixed || Number(box && box.dataset.step) || 1;
          // el modelo se arma en otra tarea, así el navegador respira entre una cosa y otra
          setTimeout(function () {
            if (!started || !viewer || viewer.dead) { done(); return; }
            var T1 = performance.now();
            try {
              viewer.setModel(key);
              if (fixed) viewer.setStep(fixed, true);
              if (kind === 'custom') { viewer.noHi = true; viewer.setStep(viewer.model.lastStep || 99, true); }
              (window.__glTimes = window.__glTimes || []).push({ tipo: kind, modo: viewer.mode, crear: Math.round(T1 - T0), modelo: Math.round(performance.now() - T1) });
              viewer.request();
              container.classList.add('gl-ready');
              viewer.resize();
            } catch (err2) { viewer.fail(); started = false; done(); return; }
            if (!fixed && box) {
              on(box, 'nexo-step', function (e) { if (viewer && !viewer.dead) viewer.setStep(Number(e.detail) || 1); });
              if (kind === 'builds') on(box, 'nexo-type', function (e) { if (viewer && !viewer.dead) viewer.setModel(e.detail); });
            } else if (!fixed && loopN) {
              if (cap.reduce) viewer.setStep(loopN, true); else startLoop();   // con movimiento reducido queda armado y quieto
            }
            done();
          }, 0);
        }).catch(function () { started = false; container.classList.add('gl-failed'); container.dataset.glState = 'off'; done(); });
      });
    }

    // Fuera de pantalla el visor se "duerme": libera la memoria de video para cuidar a los equipos más lentos
    function sleep() {
      if (!started) return;
      started = false;
      timers.forEach(clearTimeout); timers = [];
      hooks.forEach(function (h) { h[0].removeEventListener(h[1], h[2]); }); hooks = [];
      if (viewer) {
        viewer.destroy();
        instances = instances.filter(function (v) { return v !== viewer; });
        viewer = null;
        var old = container.querySelector('canvas.gl-canvas');
        if (old && old.parentNode) {
          var fresh = old.cloneNode(false);
          old.parentNode.replaceChild(fresh, old);
        }
      }
      container.classList.remove('gl-ready');
      container.dataset.glState = 'sleep';
    }

    var far = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        inRange = e.isIntersecting;
        if (inRange && !started && !is2d()) start();
        else if (!inRange && started) sleep();
      });
    }, { rootMargin: '1200px 0px' });
    far.observe(container);
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (viewer && !viewer.dead) { viewer.visible = visible && !is2d(); if (viewer.visible) viewer.request(); }
      });
    }, { threshold: 0.2 });
    vis.observe(container);
    container.__glObservers = [far, vis];
    container.__glSleep = sleep;
  }

  window.NexoGL = {
    // verdadero si algún visor está dibujando en este momento
    busy: function () { return instances.some(function (v) { return !v.dead && v.visible && v.rafId; }); },
    // el cómputo pasa las medidas nuevas y los visores del tipo "custom" se redibujan
    setParam: function (P) {
      window.NexoParam = P;
      instances.forEach(function (v) { if (!v.dead && v.container.dataset.gl === 'custom') v.reloadCustom(); });
    },
    scan: function () {
      instances = instances.filter(function (v) {
        if (!v.container.isConnected) { v.destroy(); (v.container.__glObservers || []).forEach(function (o) { o.disconnect(); }); return false; }
        return true;
      });
      document.querySelectorAll('[data-gl]').forEach(mount);
    }
  };
})();
