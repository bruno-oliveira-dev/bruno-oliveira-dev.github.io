import * as THREE from 'three';

/* Cenas 3D da landing: uma tela WebGL por <canvas data-cena="...">. */
class Landing {
  constructor() {
    this.nota = 4.6;      // nota de exemplo que o visor do hero conta
    this.animar = true;
    this.pausado = false;
    this.cenas = {};
  }

  // Sem WebGL: o ícone do app entra no lugar da cena do hero
  falhou() {
    const img = document.getElementById('sem-3d');
    if (img) img.hidden = false;
  }

  montar(nome, el) {
    var self = this;
    this.cenas = this.cenas || {};
    if (!el) { this.desmontar(nome); return; }
    if (this.cenas[nome] && this.cenas[nome].canvas === el) return;
    this.desmontar(nome);
    var tentar = function (n) {
      if (!el.isConnected) return;
      if (self.cenas[nome]) return;
      if (!THREE) {
        if (n < 60) setTimeout(function () { tentar(n + 1); }, 120); else self.falhou();
        return;
      }
      try {
        self.cenas[nome] = self.criarCena(nome, el);
        self.iniciarLaco();
      } catch (e) {
        if (window.console) console.warn('Cena 3D indisponível:', nome, e);
        self.falhou();
      }
    };
    tentar(0);
  }

  desmontar(nome) {
    var c = this.cenas && this.cenas[nome];
    if (!c) return;
    try { c.ro && c.ro.disconnect(); c.io && c.io.disconnect(); c.renderer.dispose(); } catch (e) {}
    delete this.cenas[nome];
  }

  /* ---------- peças reutilizadas pelas cenas ---------- */
  kit(T) {
    var VERDE = 0x0b6e4f;
    var m = function (cor, rug, metal) { return new T.MeshStandardMaterial({ color: cor, roughness: rug == null ? 0.62 : rug, metalness: metal || 0 }); };
    var rr = function (w, h, r) {
      var s = new T.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };
    // caixa com cantos arredondados: w (x), h (y), d (z)
    var caixa = function (w, h, d, r, bv) {
      r = Math.min(r == null ? 0.08 : r, w / 2, h / 2);
      bv = Math.min(bv == null ? 0.04 : bv, r * 0.9, d * 0.45);
      var g = new T.ExtrudeGeometry(rr(w - 2 * bv, h - 2 * bv, Math.max(r - bv, 0.004)), { depth: d - 2 * bv, bevelEnabled: true, bevelSize: bv, bevelThickness: bv, bevelSegments: 3, curveSegments: 10 });
      g.translate(0, 0, -(d - 2 * bv) / 2);
      return g;
    };
    // placa deitada: w (x), d (z), h (y), cantos arredondados vistos de cima
    var placa = function (w, d, h, r, bv) { var g = caixa(w, d, h, r, bv); g.rotateX(-Math.PI / 2); return g; };
    var por = function (pai, geo, mat, x, y, z) {
      var o = new T.Mesh(geo, mat);
      o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = true; o.receiveShadow = true;
      pai.add(o);
      return o;
    };
    var suave = function (x) { return 1 - Math.pow(1 - x, 3); };
    var pop = function (x) { return x <= 0 ? 0.0001 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); };
    var textura = function (c, w, h, desenha) {
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var ctx = cv.getContext('2d');
      var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
      var o = { t: t, args: [] };
      o.pinta = function () {
        o.args = Array.prototype.slice.call(arguments);
        ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        desenha.apply(null, [ctx, w, h].concat(o.args));
        ctx.restore();
        t.needsUpdate = true;
      };
      c.texturas.push(o);
      return o;
    };
    var caminho = function (ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    };

    /* visor de 7 segmentos, como o de litros e preço */
    var SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    var digito = function (ctx, x, y, w, h, t, ligados, aceso, apagado) {
      var md = h / 2, p = t / 2;
      var seg = {
        a: [x + t, y, w - 2 * t, t, 'h'], d: [x + t, y + h - t, w - 2 * t, t, 'h'], g: [x + t, y + md - t / 2, w - 2 * t, t, 'h'],
        f: [x, y + t, t, md - 1.5 * t, 'v'], b: [x + w - t, y + t, t, md - 1.5 * t, 'v'],
        e: [x, y + md + t / 2, t, md - 1.5 * t, 'v'], c: [x + w - t, y + md + t / 2, t, md - 1.5 * t, 'v']
      };
      for (var nome in seg) {
        var s = seg[nome], sx = s[0], sy = s[1], sw = s[2], sh = s[3];
        ctx.fillStyle = ligados.indexOf(nome) >= 0 ? aceso : apagado;
        ctx.beginPath();
        if (s[4] === 'h') {
          ctx.moveTo(sx + p, sy); ctx.lineTo(sx + sw - p, sy); ctx.lineTo(sx + sw, sy + p);
          ctx.lineTo(sx + sw - p, sy + sh); ctx.lineTo(sx + p, sy + sh); ctx.lineTo(sx, sy + p);
        } else {
          ctx.moveTo(sx, sy + p); ctx.lineTo(sx + p, sy); ctx.lineTo(sx + sw, sy + p);
          ctx.lineTo(sx + sw, sy + sh - p); ctx.lineTo(sx + p, sy + sh); ctx.lineTo(sx, sy + sh - p);
        }
        ctx.closePath(); ctx.fill();
      }
    };
    var pintaVisor = function (ctx, w, h, valor, rgb, tl, tr, bl, br) {
      var aceso = 'rgb(' + rgb + ')', meio = 'rgba(' + rgb + ',0.6)', apagado = 'rgba(' + rgb + ',0.07)';
      ctx.fillStyle = '#101614'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = meio; ctx.font = '600 34px Barlow, sans-serif';
      ctx.fillText(tl || '', 40, 62);
      ctx.textAlign = 'right'; ctx.fillText(tr || '', 600, 62); ctx.textAlign = 'left';
      var inteiro = Math.floor(valor + 1e-6), decimal = Math.round((valor - inteiro) * 10) % 10;
      digito(ctx, 150, 100, 130, 200, 26, SEG[inteiro] || '', aceso, apagado);
      ctx.fillStyle = aceso; ctx.beginPath(); ctx.arc(310, 288, 13, 0, Math.PI * 2); ctx.fill();
      digito(ctx, 340, 100, 130, 200, 26, SEG[decimal] || '', aceso, apagado);
      ctx.fillStyle = meio; ctx.font = '600 30px Barlow, sans-serif';
      ctx.fillText(bl || '', 40, 360);
      ctx.textAlign = 'right'; ctx.fillText(br || '', 600, 360);
    };

    var bomba = function (c, op) {
      op = op || {};
      var g = new T.Group();
      var branco = m(0xf2f5f3, 0.5), verde = m(VERDE, 0.5), escuro = m(0x1b2224, 0.6), concreto = m(0x9aa5a2, 0.9);
      por(g, placa(2.4, 1.5, 0.3, 0.14, 0.05), concreto, 0, 0.15, 0);
      por(g, caixa(1.7, 3.2, 1.0, 0.16, 0.08), branco, 0, 1.9, 0);
      por(g, caixa(1.76, 0.95, 1.06, 0.14, 0.07), verde, 0, 0.82, 0);
      por(g, caixa(1.96, 0.55, 1.14, 0.2, 0.09), verde, 0, 3.72, 0);
      por(g, caixa(1.46, 1.0, 0.08, 0.06, 0.02), escuro, 0, 2.62, 0.5);
      var visor = textura(c, 640, 400, pintaVisor);
      var tela = new T.Mesh(new T.PlaneGeometry(1.32, 0.825), new T.MeshBasicMaterial({ map: visor.t, toneMapped: false }));
      tela.position.set(0, 2.62, 0.546);
      g.add(tela);
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) por(g, caixa(0.16, 0.12, 0.05, 0.03, 0.015), escuro, -0.25 + j * 0.25, 1.85 - i * 0.18, 0.51);
      por(g, caixa(0.14, 0.7, 0.42, 0.05, 0.03), escuro, 0.9, 1.95, 0.05);
      if (!op.semMangueira) {
        por(g, caixa(0.13, 0.42, 0.2, 0.05, 0.03), escuro, 1.02, 1.95, 0.05);
        var ponta = por(g, new T.CylinderGeometry(0.035, 0.035, 0.42, 16), m(0xb8c0be, 0.3, 0.7), 1.14, 2.15, 0.05);
        ponta.rotation.z = Math.PI / 2.4;
        var curva = new T.CatmullRomCurve3([
          new T.Vector3(0.86, 3.3, 0.1), new T.Vector3(1.3, 3.05, 0.25), new T.Vector3(1.5, 1.6, 0.45),
          new T.Vector3(1.35, 0.75, 0.4), new T.Vector3(1.08, 1.0, 0.2), new T.Vector3(1.03, 1.72, 0.05)
        ]);
        por(g, new T.TubeGeometry(curva, 80, 0.045, 10), escuro, 0, 0, 0);
      }
      g.userData.visor = visor;
      return g;
    };

    var carro = function (cor) {
      var g = new T.Group();
      var lata = m(cor == null ? 0xf2f5f3 : cor, 0.42), vidro = m(0x161d1f, 0.25), pneu = m(0x15191a, 0.85), aro = m(0xc9d1ce, 0.4, 0.3);
      por(g, caixa(3.6, 0.66, 1.6, 0.28, 0.1), lata, 0, 0.66, 0);
      var s = new T.Shape();
      s.moveTo(-1.2, 0); s.lineTo(-0.82, 0.5); s.quadraticCurveTo(-0.77, 0.56, -0.66, 0.56);
      s.lineTo(0.5, 0.56); s.quadraticCurveTo(0.61, 0.56, 0.68, 0.5); s.lineTo(1.15, 0); s.lineTo(-1.2, 0);
      var cab = new T.ExtrudeGeometry(s, { depth: 1.26, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 8 });
      cab.translate(0, 0, -0.63);
      por(g, cab, vidro, -0.2, 0.95, 0);
      por(g, placa(1.34, 1.34, 0.07, 0.22, 0.03), lata, -0.28, 1.58, 0);
      var gp = new T.CylinderGeometry(0.36, 0.36, 0.28, 32); gp.rotateX(Math.PI / 2);
      var ga = new T.CylinderGeometry(0.19, 0.19, 0.3, 24); ga.rotateX(Math.PI / 2);
      [[1.15, 0.72], [1.15, -0.72], [-1.15, 0.72], [-1.15, -0.72]].forEach(function (p) {
        por(g, gp, pneu, p[0], 0.36, p[1]);
        por(g, ga, aro, p[0], 0.36, p[1]);
      });
      var farol = new T.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd98a, emissiveIntensity: 0.7, roughness: 0.3 });
      var lanterna = new T.MeshStandardMaterial({ color: 0xd8344a, emissive: 0xc8283a, emissiveIntensity: 0.5, roughness: 0.3 });
      [0.5, -0.5].forEach(function (z) {
        por(g, caixa(0.08, 0.14, 0.34, 0.04, 0.02), farol, 1.78, 0.76, z);
        por(g, caixa(0.08, 0.14, 0.34, 0.04, 0.02), lanterna, -1.78, 0.76, z);
      });
      return g;
    };

    var pino = function (cor) {
      var g = new T.Group(), mat = m(cor, 0.4);
      por(g, new T.SphereGeometry(0.2, 32, 16), mat, 0, 0.62, 0);
      var corpo = por(g, new T.ConeGeometry(0.2, 0.5, 32, 1, true), mat, 0, 0.36, 0);
      corpo.rotation.x = Math.PI;
      por(g, new T.SphereGeometry(0.078, 16, 8), m(0xffffff, 0.4), 0.105, 0.66, 0.105);
      return g;
    };

    var selo = function () {
      var g = new T.Group();
      var gd = new T.CylinderGeometry(0.62, 0.62, 0.16, 64); gd.rotateX(Math.PI / 2);
      por(g, gd, m(0x16a06f, 0.4), 0, 0, 0);
      por(g, new T.TorusGeometry(0.62, 0.06, 16, 64), m(0xffffff, 0.35), 0, 0, 0);
      var f = new T.Shape();
      f.moveTo(-0.32, 0.02); f.lineTo(-0.2, 0.14); f.lineTo(-0.08, 0.02); f.lineTo(0.24, 0.34); f.lineTo(0.36, 0.22); f.lineTo(-0.08, -0.22); f.lineTo(-0.32, 0.02);
      por(g, new T.ExtrudeGeometry(f, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), m(0xffffff, 0.35), 0, -0.04, 0.07);
      return g;
    };

    var telefone = function (tex) {
      var g = new T.Group();
      por(g, caixa(1.5, 3.1, 0.16, 0.24, 0.05), m(0x161d1f, 0.4), 0, 0, 0);
      var tela = new T.Mesh(new T.PlaneGeometry(1.38, 2.98), new T.MeshBasicMaterial({ map: tex.t, toneMapped: false }));
      tela.position.z = 0.083;
      g.add(tela);
      return g;
    };

    return { T: T, m: m, caixa: caixa, placa: placa, por: por, suave: suave, pop: pop, textura: textura, caminho: caminho, bomba: bomba, carro: carro, pino: pino, selo: selo, telefone: telefone };
  }

  /* ---------- cena: uma tela WebGL por canvas ---------- */
  criarCena(nome, canvas) {
    var self = this, T = THREE, k = this.kit(T);
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene();
    var cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
    var c = { nome: nome, canvas: canvas, renderer: renderer, scene: scene, cam: cam, mundo: new T.Group(), alvo: new T.Vector3(0, 1.8, 0), fitW: 9, fitH: 7, pops: [], texturas: [], visivel: true, t0: null, w: 0, sombra: 0.26, fase: nome.length * 1.7, sujo: true };
    scene.add(c.mundo);
    this['cena_' + nome](T, k, c);

    scene.add(new T.HemisphereLight(0xffffff, 0x8a9692, 1.35));
    var sol = new T.DirectionalLight(0xffffff, 2.0);
    sol.position.set(c.alvo.x - 5, c.alvo.y + 12, c.alvo.z + 8);
    sol.target.position.copy(c.alvo);
    scene.add(sol.target);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    var sc = sol.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 50;
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03; sol.shadow.radius = 5;
    scene.add(sol);
    var apoio = new T.DirectionalLight(0xffffff, 0.7);
    apoio.position.set(8, 6, 2);
    scene.add(apoio);
    var chao = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: c.sombra }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    scene.add(chao);

    // câmera isométrica
    cam.position.set(c.alvo.x + 20, c.alvo.y + 16.4, c.alvo.z + 20);
    cam.lookAt(c.alvo);

    var ajustar = function () {
      var el = canvas.parentElement;
      if (!el) return;
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      c.w = w;
      renderer.setSize(w, h, false);
      var a = w / h, hh = Math.max(c.fitH, c.fitW / a) / 2;
      cam.left = -hh * a; cam.right = hh * a; cam.top = hh; cam.bottom = -hh;
      cam.updateProjectionMatrix();
      c.sujo = true;
    };
    if (window.ResizeObserver) { c.ro = new ResizeObserver(ajustar); c.ro.observe(canvas.parentElement); }
    ajustar();
    if (window.IntersectionObserver) {
      c.io = new IntersectionObserver(function (es) { c.visivel = es[0].isIntersecting; }, { rootMargin: '80px' });
      c.io.observe(canvas);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        c.texturas.forEach(function (o) { if (o.args.length || o.semArgs) o.pinta.apply(null, o.args); });
        c.sujo = true;
      });
    }
    return c;
  }

  iniciarLaco() {
    var self = this;
    if (!this._ptr) {
      this.px = 0; this.py = 0;
      this._ptr = function (e) { self.px = (e.clientX / window.innerWidth) * 2 - 1; self.py = (e.clientY / window.innerHeight) * 2 - 1; };
      window.addEventListener('pointermove', this._ptr, { passive: true });
    }
    if (this._raf) return;
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var suave = function (x) { return 1 - Math.pow(1 - x, 3); };
    var pop = function (x) { return x <= 0 ? 0.0001 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); };
    var passo = function (agora) {
      self._raf = requestAnimationFrame(passo);
      var s = agora / 1000;
      var parado = (mq && mq.matches) || self.animar === false;
      for (var n in self.cenas) {
        var c = self.cenas[n];
        if (!c || !c.visivel || !c.w) continue;
        var dt = c.ult == null ? 0 : Math.min(s - c.ult, 0.1);
        c.ult = s;
        if (self.pausado && !parado) {
          // pausa: congela no quadro atual; só redesenha se o tamanho mudou
          if (c.sujo && c.tt != null) { c.renderer.render(c.scene, c.cam); c.sujo = false; }
          if (c.tt != null) continue;
        }
        if (parado && !c.sujo && c.notaFeita === self.nota && c.paradoFeito) continue;
        c.tt = (c.tt || 0) + dt;
        var t = parado ? 40 : c.tt;
        for (var i = 0; i < c.pops.length; i++) c.pops[i][0].scale.setScalar(pop((t - c.pops[i][1]) / 0.65) * (c.pops[i][2] || 1));
        c.mundo.position.y = -0.9 * (1 - suave(Math.min(t / 1.0, 1)));
        var giro = parado ? 0 : Math.sin(t * 0.35 + c.fase) * 0.07 + self.px * 0.14;
        c.mundo.rotation.y += (giro - c.mundo.rotation.y) * (parado ? 1 : 0.06);
        c.atualiza(t);
        c.renderer.render(c.scene, c.cam);
        c.sujo = false; c.notaFeita = self.nota; c.paradoFeito = parado;
      }
    };
    this._raf = requestAnimationFrame(passo);
  }

  /* ---------- HERO: carro abastecendo, visor contando a nota ---------- */
  cena_hero(T, k, c) {
    var self = this, h = 0.34;
    c.fitW = 10.8; c.fitH = 8.7; c.alvo.set(0, 2.0, 0);
    k.por(c.mundo, k.placa(8.4, 5.6, h, 0.7, 0.08), k.m(0x3a474b, 0.85), 0, h / 2, 0);
    var tinta = k.m(0xffb627, 0.7);
    k.por(c.mundo, k.placa(4.3, 0.09, 0.02, 0.04, 0.005), tinta, 1.4, h + 0.01, -0.45);
    k.por(c.mundo, k.placa(4.3, 0.09, 0.02, 0.04, 0.005), tinta, 1.4, h + 0.01, 1.95);

    var bomba = k.bomba(c, { semMangueira: true });
    bomba.position.set(-2.5, h, -0.9);
    c.mundo.add(bomba);
    var visor = bomba.userData.visor;

    var carro = k.carro(0xf2f5f3);
    carro.position.set(1.4, h, 0.75);
    c.mundo.add(carro);

    var mangueira = new T.Group();
    var curva = new T.CatmullRomCurve3([
      new T.Vector3(-1.64, h + 3.3, -0.8), new T.Vector3(-1.1, h + 3.1, -0.5), new T.Vector3(-0.82, h + 1.7, 0.15),
      new T.Vector3(-0.78, h + 1.0, 0.6), new T.Vector3(-0.6, h + 0.86, 0.72)
    ]);
    var escuro = k.m(0x1b2224, 0.6);
    k.por(mangueira, new T.TubeGeometry(curva, 80, 0.05, 10), escuro, 0, 0, 0);
    k.por(mangueira, k.caixa(0.34, 0.17, 0.15, 0.06, 0.03), escuro, -0.56, h + 0.87, 0.72);
    c.mundo.add(mangueira);

    var selo = k.selo();
    selo.position.set(-2.5, h + 5.0, -0.9);
    c.mundo.add(selo);

    // outros postos ao redor: bem avaliados, um com alerta da ANP, um ainda sem avaliações
    var dados = [[4.9, -1.5, 0x2fa477], [3.4, 3.5, 0xe0364a], [-4.7, 1.9, 0x2fa477], [-2.9, 4.0, 0x9aa8a4]];
    var pinos = dados.map(function (d, i) {
      var g = new T.Group();
      k.por(g, new T.CylinderGeometry(0.62, 0.62, 0.18, 40), k.m(0x2c383b, 0.85), 0, 0.09, 0);
      var p = k.pino(d[2]);
      p.scale.setScalar(1.5); p.position.y = 0.18;
      g.add(p);
      g.position.set(d[0], 0, d[1]);
      g.userData.pino = p;
      c.mundo.add(g);
      c.pops.push([g, 1.0 + i * 0.16]);
      return p;
    });
    c.pops.push([bomba, 0.1], [carro, 0.35], [selo, 2.6]);

    c.atualiza = function (t) {
      var p = k.suave(Math.min(Math.max((t - 0.7) / 2.2, 0), 1));
      var v = Math.round(self.nota * p * 10) / 10, n = Math.round(40 * p);
      if (v !== c.v || n !== c.n) {
        c.v = v; c.n = n;
        visor.pinta(v, '255,182,39', 'NOTA DO POSTO', 'DE 5', n + ' AVALIAÇÕES', 'ANP: SEM AUTOS');
      }
      mangueira.visible = t > 0.8;
      selo.rotation.y = Math.PI / 4 + Math.sin(t * 0.9) * 0.45;
      selo.position.y = h + 5.0 + Math.sin(t * 1.3) * 0.1;
      pinos.forEach(function (pn, i) { pn.position.y = 0.18 + Math.max(0, Math.sin(t * 1.6 + i * 1.3)) * 0.12; });
    };
  }

  /* ---------- FONTE 1: celular lendo o QR do cupom ---------- */
  cena_motoristas(T, k, c) {
    var h = 0.3;
    c.fitW = 8.6; c.fitH = 7.6; c.alvo.set(0, 2.0, 0); c.sombra = 0.3;
    k.por(c.mundo, k.placa(5.4, 3.8, h, 0.6, 0.08), k.m(0x084d38, 0.85), 0, h / 2, 0);

    var leitor = k.textura(c, 552, 1192, function (ctx, w, hh) {
      ctx.fillStyle = '#161d1f'; ctx.fillRect(0, 0, w, hh);
      k.caminho(ctx, 0, 0, w, hh, 70); ctx.fillStyle = '#101614'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '700 46px Barlow, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Avaliar posto', w / 2, 150);
      var x = 106, y = 330, s = 340, L = 70;
      ctx.strokeStyle = '#ffb627'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]].forEach(function (q) {
        ctx.beginPath(); ctx.moveTo(q[0] + q[2] * L, q[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + q[3] * L); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(255,182,39,0.16)'; ctx.fillRect(x + 20, y + 20, s - 40, s - 40);
      ctx.fillStyle = '#ffb627'; ctx.fillRect(x + 10, y + s / 2 - 4, s - 20, 8);
      ctx.fillStyle = '#d3dcd9'; ctx.font = '500 36px Barlow, sans-serif';
      ctx.fillText('Leia o QR do', w / 2, 800); ctx.fillText('cupom fiscal', w / 2, 848);
      k.caminho(ctx, 86, 960, w - 172, 110, 55); ctx.fillStyle = '#0b6e4f'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '600 38px Barlow, sans-serif'; ctx.fillText('Avaliar sem cupom', w / 2, 1028);
    });
    leitor.semArgs = true; leitor.pinta();
    var tel = k.telefone(leitor);
    tel.rotation.set(-0.16, 0.55, 0, 'YXZ');
    tel.position.set(-1.05, h + 1.62, -0.25);
    c.mundo.add(tel);

    var papel = k.textura(c, 520, 792, function (ctx, w, hh) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, hh);
      ctx.fillStyle = '#2b2b2b'; ctx.textAlign = 'center'; ctx.font = '700 30px "Courier Prime", "Courier New", monospace';
      ctx.fillText('AUTO POSTO EXEMPLO', w / 2, 70);
      ctx.font = '400 24px "Courier Prime", "Courier New", monospace'; ctx.fillText('CUPOM FISCAL', w / 2, 108);
      ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(40, 140); ctx.lineTo(w - 40, 140); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b9bfbd';
      [[170, 300], [210, 240], [250, 330]].forEach(function (r) { ctx.fillRect(40, r[0], r[1], 16); ctx.fillRect(w - 130, r[0], 90, 16); });
      ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(40, 300); ctx.lineTo(w - 40, 300); ctx.stroke(); ctx.setLineDash([]);
      // QR ilustrativo
      var q = 300, x0 = (w - q) / 2, y0 = 360, nn = 21, cel = q / nn, sem = 7;
      ctx.fillStyle = '#1a2421';
      for (var i = 0; i < nn; i++) for (var j = 0; j < nn; j++) {
        sem = (sem * 1103515245 + 12345) % 2147483648;
        var canto = (i < 7 && j < 7) || (i > 13 && j < 7) || (i < 7 && j > 13);
        if (!canto && (sem >> 8) % 2) ctx.fillRect(x0 + i * cel, y0 + j * cel, cel + 0.5, cel + 0.5);
      }
      [[0, 0], [14, 0], [0, 14]].forEach(function (p) {
        ctx.fillStyle = '#1a2421'; ctx.fillRect(x0 + p[0] * cel, y0 + p[1] * cel, 7 * cel, 7 * cel);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + (p[0] + 1) * cel, y0 + (p[1] + 1) * cel, 5 * cel, 5 * cel);
        ctx.fillStyle = '#1a2421'; ctx.fillRect(x0 + (p[0] + 2) * cel, y0 + (p[1] + 2) * cel, 3 * cel, 3 * cel);
      });
      ctx.fillStyle = '#6b6b6b'; ctx.font = '400 22px "Courier Prime", "Courier New", monospace'; ctx.fillText('Exemplo ilustrativo', w / 2, 730);
    });
    papel.semArgs = true; papel.pinta();
    var cupom = new T.Group();
    k.por(cupom, new T.BoxGeometry(1.3, 1.98, 0.02), k.m(0xffffff, 0.8), 0, 0, 0);
    var frente = new T.Mesh(new T.PlaneGeometry(1.3, 1.98), new T.MeshStandardMaterial({ map: papel.t, roughness: 0.8 }));
    frente.position.z = 0.0115;
    cupom.add(frente);
    var feixe = new T.Mesh(new T.BoxGeometry(1.42, 0.05, 0.03), new T.MeshBasicMaterial({ color: 0xffb627 }));
    feixe.position.z = 0.04;
    cupom.add(feixe);
    cupom.rotation.set(-0.28, 0.8, 0.06, 'YXZ');
    cupom.position.set(1.3, h + 1.55, 0.55);
    c.mundo.add(cupom);

    var selo = k.selo();
    selo.position.set(0.25, h + 3.9, 0.2);
    c.mundo.add(selo);
    c.pops.push([tel, 0.15], [cupom, 0.5], [selo, 1.7]);

    c.atualiza = function (t) {
      cupom.position.y = h + 1.55 + Math.sin(t * 1.2) * 0.08;
      feixe.position.y = -0.33 + Math.sin(t * 2.2) * 0.42;
      selo.rotation.y = Math.PI / 4 + Math.sin(t * 0.9 + 1) * 0.45;
      selo.position.y = h + 3.9 + Math.sin(t * 1.4) * 0.09;
    };
  }

  /* ---------- FONTE 2: bomba fiscalizada, com alerta ---------- */
  cena_anp(T, k, c) {
    var h = 0.3;
    c.fitW = 8.6; c.fitH = 7.8; c.alvo.set(0, 2.15, 0); c.sombra = 0.42;
    k.por(c.mundo, k.placa(5.4, 3.8, h, 0.6, 0.08), k.m(0x3a474b, 0.85), 0, h / 2, 0);
    var bomba = k.bomba(c);
    bomba.position.set(-0.55, h, -0.2);
    c.mundo.add(bomba);
    bomba.userData.visor.pinta(2.9, '255,104,104', 'NOTA DO POSTO', 'DE 5', 'ALERTA', 'REGISTRO DA ANP');

    var alerta = new T.Group();
    var tri = new T.Shape();
    tri.moveTo(0, 0.6); tri.lineTo(0.62, -0.42); tri.lineTo(-0.62, -0.42); tri.lineTo(0, 0.6);
    var gt = new T.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: true, bevelSize: 0.09, bevelThickness: 0.05, bevelSegments: 4 });
    gt.translate(0, 0, -0.05);
    k.por(alerta, gt, k.m(0xe0364a, 0.45), 0, 0, 0);
    var brancoM = k.m(0xffffff, 0.4);
    k.por(alerta, k.caixa(0.13, 0.42, 0.06, 0.06, 0.02), brancoM, 0, 0.1, 0.12);
    k.por(alerta, new T.SphereGeometry(0.075, 16, 12), brancoM, 0, -0.24, 0.12);
    alerta.position.set(1.55, h + 4.0, 0.5);
    c.mundo.add(alerta);

    var lupa = new T.Group();
    var metal = k.m(0xeef2f0, 0.35, 0.2);
    k.por(lupa, new T.TorusGeometry(0.5, 0.07, 16, 48), metal, 0, 0, 0);
    var lente = new T.Mesh(new T.CircleGeometry(0.5, 40), new T.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false }));
    lupa.add(lente);
    var cabo = k.por(lupa, new T.CylinderGeometry(0.075, 0.075, 0.72, 16), k.m(0x1b2224, 0.6), 0.62, -0.62, 0);
    cabo.rotation.z = Math.PI / 4;
    c.mundo.add(lupa);
    c.pops.push([bomba, 0.15], [lupa, 1.0], [alerta, 1.6]);

    c.atualiza = function (t) {
      lupa.position.set(-0.55 + Math.sin(t * 0.8) * 0.36, h + 2.62 + Math.cos(t * 0.62) * 0.2, 1.05);
      alerta.rotation.y = Math.PI / 4 + Math.sin(t * 0.8) * 0.4;
      alerta.position.y = h + 4.0 + Math.sin(t * 1.5) * 0.1;
    };
  }

  /* ---------- O APP: celular com a lista de postos ---------- */
  cena_app(T, k, c) {
    var h = 0.3;
    c.fitW = 7.2; c.fitH = 7.5; c.alvo.set(0, 2.35, 0); c.sombra = 0.2;
    k.por(c.mundo, k.placa(5.4, 3.8, h, 0.6, 0.08), k.m(0xf6f9f7, 0.9), 0, h / 2, 0);

    var lista = k.textura(c, 552, 1192, function (ctx, w, hh) {
      ctx.fillStyle = '#161d1f'; ctx.fillRect(0, 0, w, hh);
      k.caminho(ctx, 0, 0, w, hh, 70); ctx.fillStyle = '#f3f4f6'; ctx.fill();
      ctx.fillStyle = '#1a2421'; ctx.font = '700 46px Barlow, sans-serif';
      ctx.fillText('Postos perto de você', 36, 150);
      var x = 36;
      [['5 km', true], ['10 km', false], ['Todas', false]].forEach(function (ch) {
        ctx.font = (ch[1] ? '600' : '500') + ' 30px Barlow, sans-serif';
        var lw = ctx.measureText(ch[0]).width + 40;
        k.caminho(ctx, x, 190, lw, 56, 14);
        if (ch[1]) { ctx.fillStyle = '#d2e3dd'; ctx.fill(); ctx.fillStyle = '#0b6e4f'; }
        else { ctx.strokeStyle = '#b9c2bf'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#1a2421'; }
        ctx.fillText(ch[0], x + 20, 229);
        x += lw + 12;
      });
      var linhas = [
        ['Auto Posto Primavera', '800 m', '4,8 · 52 avaliações', '#0b6e4f'],
        ['Posto Estrela da Serra', '1,4 km', '4,5 · 19 avaliações', '#0b6e4f'],
        ['Posto Rota Sul', '2,1 km', '2,9 · registro da ANP', '#c8283a'],
        ['Comercial Ipê Amarelo', '3,7 km', 'Ainda sem avaliações', '#5d6663']
      ];
      var y0 = 286, alt = 168;
      k.caminho(ctx, 28, y0, w - 56, alt * linhas.length, 28); ctx.fillStyle = '#ffffff'; ctx.fill();
      linhas.forEach(function (l, i) {
        var y = y0 + i * alt;
        if (i) { ctx.fillStyle = '#e6e8ea'; ctx.fillRect(28, y, w - 56, 2); }
        ctx.textAlign = 'left'; ctx.fillStyle = '#1a2421'; ctx.font = '700 33px Barlow, sans-serif'; ctx.fillText(l[0], 54, y + 68);
        ctx.textAlign = 'right'; ctx.fillStyle = '#5d6663'; ctx.font = '500 28px Barlow, sans-serif'; ctx.fillText(l[1], w - 54, y + 68);
        ctx.textAlign = 'left'; ctx.fillStyle = l[3]; ctx.font = '600 29px Barlow, sans-serif'; ctx.fillText(l[2], 54, y + 118);
      });
    });
    lista.semArgs = true; lista.pinta();
    var tel = k.telefone(lista);
    tel.scale.setScalar(1.32);
    tel.rotation.set(-0.14, 0.62, 0, 'YXZ');
    tel.position.set(-0.1, h + 2.14, -0.25);
    c.mundo.add(tel);
    c.pops.push([tel, 0.15, 1.32]);

    var dados = [[-2.0, 1.1, 0x2fa477], [1.9, 1.2, 0xe0364a], [2.05, -0.9, 0x2fa477], [-0.3, 1.45, 0x9aa8a4]];
    var pinos = dados.map(function (d, i) {
      var p = k.pino(d[2]);
      p.position.set(d[0], h, d[1]);
      c.mundo.add(p);
      c.pops.push([p, 0.9 + i * 0.18, 1.25]);
      return p;
    });
    c.atualiza = function (t) {
      tel.position.y = h + 2.14 + Math.sin(t * 1.1) * 0.05;
      pinos.forEach(function (p, i) { p.position.y = h + Math.max(0, Math.sin(t * 1.7 + i * 1.5)) * 0.1; });
    };
  }

  /* ---------- MARCAR: pino caindo no mapa, ao lado da rodovia ---------- */
  cena_mapa(T, k, c) {
    var h = 0.32;
    c.fitW = 8.5; c.fitH = 6.3; c.alvo.set(0, 1.3, 0); c.sombra = 0.3;
    k.por(c.mundo, k.placa(6.6, 4.6, h, 0.7, 0.08), k.m(0x084d38, 0.85), 0, h / 2, 0);

    var mapa = k.textura(c, 1220, 820, function (ctx, w, hh) {
      ctx.clearRect(0, 0, w, hh);
      ctx.save();
      k.caminho(ctx, 0, 0, w, hh, 96); ctx.clip();
      ctx.fillStyle = '#e3ece8'; ctx.fillRect(0, 0, w, hh);
      ctx.fillStyle = '#cfe6da'; k.caminho(ctx, 420, 590, 320, 170, 30); ctx.fill();
      ctx.fillStyle = '#d6e0dc'; k.caminho(ctx, 930, 60, 220, 120, 20); ctx.fill(); k.caminho(ctx, 60, 300, 180, 130, 20); ctx.fill();
      ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff';
      var rua = function (pts, lw) { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
      rua([[300, -20], [340, 840]], 26); rua([[860, -20], [820, 840]], 26);
      rua([[-20, 210], [1240, 250]], 22); rua([[560, 840], [1240, 380]], 18);
      ctx.strokeStyle = '#aab7b3'; rua([[-20, 500], [1240, 500]], 74);
      ctx.strokeStyle = '#4a5753'; rua([[-20, 500], [1240, 500]], 64);
      ctx.setLineDash([34, 28]); ctx.lineCap = 'butt'; ctx.strokeStyle = '#ffb627'; rua([[-20, 500], [1240, 500]], 6);
      ctx.restore();
    });
    mapa.semArgs = true; mapa.pinta();
    var folha = new T.Mesh(new T.PlaneGeometry(6.1, 4.1), new T.MeshStandardMaterial({ map: mapa.t, transparent: true, roughness: 0.9 }));
    folha.rotation.x = -Math.PI / 2;
    folha.position.y = h + 0.006;
    folha.receiveShadow = true;
    c.mundo.add(folha);

    var carro = k.carro(0xf2f5f3);
    c.mundo.add(carro);

    [[-2.1, -1.3], [2.2, 1.45], [-1.5, 1.4]].forEach(function (d, i) {
      var p = k.pino(0x2fa477);
      p.position.set(d[0], h, d[1]);
      c.mundo.add(p);
      c.pops.push([p, 0.5 + i * 0.15, 0.95]);
    });

    var px = 0.9, pz = -0.65;
    var pino = k.pino(0xffb627);
    c.mundo.add(pino);
    var ga = new T.RingGeometry(0.42, 0.56, 48); ga.rotateX(-Math.PI / 2);
    var anel = new T.Mesh(ga, new T.MeshBasicMaterial({ color: 0xffb627, transparent: true, opacity: 0, depthWrite: false }));
    anel.position.set(px, h + 0.02, pz);
    c.mundo.add(anel);

    c.atualiza = function (t) {
      // carro passando pela rodovia
      var cx = -2.75 + ((t * 0.9) % 5.5);
      var borda = Math.min(1, Math.min(cx + 2.75, 2.75 - cx) * 3.5);
      carro.position.set(cx, h, 0.4);
      carro.scale.setScalar(0.36 * Math.max(borda, 0.0001));
      // pino cai, quica e some para cair de novo
      var u = t % 4.6, y, e = 1;
      if (u < 0.5) { var q = u / 0.5; y = 4.2 * (1 - q * q); e = Math.min(1, u * 5); }
      else if (u < 0.95) { var b = (u - 0.5) / 0.45; y = 0.55 * Math.sin(b * Math.PI) * (1 - b * 0.4); }
      else if (u < 1.2) { var b2 = (u - 0.95) / 0.25; y = 0.14 * Math.sin(b2 * Math.PI); }
      else { y = 0; if (u > 4.25) e = Math.max(0.0001, 1 - (u - 4.25) / 0.3); }
      pino.position.set(px, h + y, pz);
      pino.scale.setScalar(2.1 * Math.max(e, 0.0001));
      var r = (u - 0.5) / 1.5;
      if (r > 0 && r < 1) { anel.scale.setScalar(0.7 + r * 2.6); anel.material.opacity = 0.9 * (1 - r); }
      else anel.material.opacity = 0;
    };
  }

}

const landing = new Landing();
document.querySelectorAll('canvas[data-cena]').forEach((el) => landing.montar(el.dataset.cena, el));

const pausa = document.getElementById('pausa');
pausa.addEventListener('click', () => {
  landing.pausado = !landing.pausado;
  document.getElementById('topo').classList.toggle('pausado', landing.pausado);
  pausa.setAttribute('aria-pressed', String(landing.pausado));
  pausa.textContent = landing.pausado ? 'Retomar animações' : 'Pausar animações';
});
