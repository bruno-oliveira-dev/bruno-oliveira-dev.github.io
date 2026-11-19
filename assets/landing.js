import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { animate, scroll, inView } from 'motion';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOTA = 4.6;
const AVALIACOES = 40;
const VERDE = 0x0b6e4f;
const VISOR = '#ffb627';

/* ---------- Visor da bomba: dígitos de 7 segmentos, como os de litros e preço ---------- */
const SEGMENTOS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function digito(ctx, x, y, w, h, t, ligados, aceso, apagado) {
  const m = h / 2;
  const seg = {
    a: [x + t, y, w - 2 * t, t, 'h'], d: [x + t, y + h - t, w - 2 * t, t, 'h'], g: [x + t, y + m - t / 2, w - 2 * t, t, 'h'],
    f: [x, y + t, t, m - 1.5 * t, 'v'], b: [x + w - t, y + t, t, m - 1.5 * t, 'v'],
    e: [x, y + m + t / 2, t, m - 1.5 * t, 'v'], c: [x + w - t, y + m + t / 2, t, m - 1.5 * t, 'v'],
  };
  for (const [nome, [sx, sy, sw, sh, o]] of Object.entries(seg)) {
    ctx.fillStyle = ligados.includes(nome) ? aceso : apagado;
    const p = t / 2;
    ctx.beginPath();
    if (o === 'h') {
      ctx.moveTo(sx + p, sy); ctx.lineTo(sx + sw - p, sy); ctx.lineTo(sx + sw, sy + p);
      ctx.lineTo(sx + sw - p, sy + sh); ctx.lineTo(sx + p, sy + sh); ctx.lineTo(sx, sy + p);
    } else {
      ctx.moveTo(sx, sy + p); ctx.lineTo(sx + p, sy); ctx.lineTo(sx + sw, sy + p);
      ctx.lineTo(sx + sw, sy + sh - p); ctx.lineTo(sx + p, sy + sh); ctx.lineTo(sx, sy + sh - p);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function criarVisor() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;

  function desenhar(valor, avaliacoes) {
    ctx.fillStyle = '#101614';
    ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = 'rgba(255,182,39,0.55)';
    ctx.font = '600 34px Barlow, sans-serif';
    ctx.fillText('NOTA DO POSTO', 40, 62);
    ctx.textAlign = 'right';
    ctx.fillText('DE 5', 600, 62);
    ctx.textAlign = 'left';
    const apagado = 'rgba(255,182,39,0.07)';
    const inteiro = Math.floor(valor);
    const decimal = Math.round((valor - inteiro) * 10) % 10;
    digito(ctx, 150, 100, 130, 200, 26, SEGMENTOS[inteiro], VISOR, apagado);
    ctx.fillStyle = VISOR;
    ctx.beginPath();
    ctx.arc(310, 288, 13, 0, Math.PI * 2);
    ctx.fill();
    digito(ctx, 340, 100, 130, 200, 26, SEGMENTOS[decimal], VISOR, apagado);
    ctx.fillStyle = 'rgba(255,182,39,0.55)';
    ctx.font = '600 30px Barlow, sans-serif';
    ctx.fillText(`${avaliacoes} AVALIAÇÕES`, 40, 360);
    ctx.textAlign = 'right';
    ctx.fillText('ANP: SEM AUTOS', 600, 360);
    ctx.textAlign = 'left';
    textura.needsUpdate = true;
  }
  return { textura, desenhar };
}

/* ---------- Chão: um pedaço de mapa com ruas ---------- */
function texturaMapa() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(512, 512, 60, 512, 512, 512);
  g.addColorStop(0, '#33504a');
  g.addColorStop(1, 'rgba(30,39,41,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = 'rgba(227,236,232,0.22)';
  ctx.lineCap = 'round';
  const rua = (pts, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    ctx.stroke();
  };
  rua([[0, 560], [1024, 470]], 26); // rodovia
  rua([[440, 0], [520, 1024]], 14);
  rua([[150, 0], [260, 1024]], 8);
  rua([[780, 0], [700, 1024]], 8);
  rua([[0, 250], [1024, 300]], 8);
  rua([[0, 820], [1024, 760]], 8);
  rua([[90, 1024], [1024, 80]], 6);
  ctx.setLineDash([22, 18]);
  ctx.strokeStyle = 'rgba(255,182,39,0.55)';
  rua([[0, 560], [1024, 470]], 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Bomba ---------- */
function montarBomba(visorTextura) {
  const bomba = new THREE.Group();
  const branco = new THREE.MeshStandardMaterial({ color: 0xf2f5f3, roughness: 0.45 });
  const verde = new THREE.MeshStandardMaterial({ color: VERDE, roughness: 0.4 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1b2224, roughness: 0.6 });
  const concreto = new THREE.MeshStandardMaterial({ color: 0x8f9a97, roughness: 0.9 });

  const peca = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    bomba.add(m);
    return m;
  };

  peca(new RoundedBoxGeometry(2.4, 0.3, 1.5, 3, 0.06), concreto, 0, 0.15, 0);
  peca(new RoundedBoxGeometry(1.7, 3.2, 1.0, 4, 0.12), branco, 0, 1.9, 0);
  peca(new RoundedBoxGeometry(1.74, 0.95, 1.04, 4, 0.1), verde, 0, 0.82, 0);
  peca(new RoundedBoxGeometry(1.95, 0.55, 1.12, 4, 0.14), verde, 0, 3.72, 0);
  peca(new RoundedBoxGeometry(1.46, 1.0, 0.06, 2, 0.03), escuro, 0, 2.62, 0.5);
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.825), new THREE.MeshBasicMaterial({ map: visorTextura, toneMapped: false }));
  visor.position.set(0, 2.62, 0.535);
  bomba.add(visor);
  // teclado
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) peca(new RoundedBoxGeometry(0.16, 0.12, 0.05, 2, 0.02), escuro, -0.25 + j * 0.25, 1.85 - i * 0.18, 0.51);

  // suporte, bico e mangueira
  peca(new RoundedBoxGeometry(0.14, 0.7, 0.42, 2, 0.04), escuro, 0.9, 1.95, 0.05);
  const bico = new THREE.Group();
  const cabo = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.42, 0.2, 2, 0.04), escuro);
  const ponta = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xb8c0be, metalness: 0.7, roughness: 0.3 }));
  ponta.rotation.z = Math.PI / 2.4;
  ponta.position.set(0.12, 0.2, 0);
  bico.add(cabo, ponta);
  bico.position.set(1.02, 1.95, 0.05);
  bico.traverse((o) => (o.castShadow = true));
  bomba.add(bico);
  const curva = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.86, 3.3, 0.1),
    new THREE.Vector3(1.3, 3.05, 0.25),
    new THREE.Vector3(1.5, 1.6, 0.45),
    new THREE.Vector3(1.35, 0.75, 0.4),
    new THREE.Vector3(1.08, 1.0, 0.2),
    new THREE.Vector3(1.03, 1.72, 0.05),
  ]);
  peca(new THREE.TubeGeometry(curva, 80, 0.045, 10), escuro, 0, 0, 0);

  return bomba;
}

function montarSelo() {
  const selo = new THREE.Group();
  const disco = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.16, 64),
    new THREE.MeshStandardMaterial({ color: VERDE, roughness: 0.35 }),
  );
  disco.rotation.x = Math.PI / 2;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 16, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  const forma = new THREE.Shape();
  forma.moveTo(-0.32, 0.02);
  forma.lineTo(-0.2, 0.14);
  forma.lineTo(-0.08, 0.02);
  forma.lineTo(0.24, 0.34);
  forma.lineTo(0.36, 0.22);
  forma.lineTo(-0.08, -0.22);
  forma.closePath();
  const check = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  );
  check.position.z = 0.07;
  selo.add(disco, aro, check);
  selo.traverse((o) => (o.castShadow = true));
  return selo;
}

function montarPino(cor) {
  const pino = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.35 });
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), mat);
  cabeca.position.y = 0.62;
  const corpo = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 32, 1, true), mat);
  corpo.rotation.x = Math.PI;
  corpo.position.y = 0.36;
  const miolo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  miolo.position.set(0, 0.64, 0.15);
  pino.add(cabeca, corpo, miolo);
  pino.traverse((o) => (o.castShadow = true));
  return pino;
}

function iniciarCena() {
  const canvas = document.getElementById('bomba');
  const recipiente = canvas.parentElement;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    recipiente.classList.add('sem-3d');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const alvo = new THREE.Vector3(0, 1.9, 0);

  cena.add(new THREE.HemisphereLight(0xe3f4ec, 0x1e2729, 1.3));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(5, 9, 6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  sol.shadow.radius = 4;
  cena.add(sol);
  const brilho = new THREE.PointLight(0xffb627, 3, 3.5);
  brilho.position.set(0, 2.6, 1.3);
  cena.add(brilho);

  const chao = new THREE.Mesh(new THREE.CircleGeometry(7.5, 96), new THREE.MeshStandardMaterial({ map: texturaMapa(), transparent: true, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);

  const { textura, desenhar } = criarVisor();
  const mundo = new THREE.Group();
  cena.add(mundo);
  const bomba = montarBomba(textura);
  mundo.add(bomba);
  const selo = montarSelo();
  selo.position.set(-1.25, 4.35, 0.55);
  mundo.add(selo);

  // Outros postos no mapa: verdes (bem avaliados), um com alerta da ANP e um ainda sem avaliações
  const cores = [0x2fa477, 0x2fa477, 0xc8283a, 0x2fa477, 0x8c9a96, 0x2fa477, 0x2fa477, 0x2fa477];
  const posicoes = [[-3.2, 1.2], [3.4, -0.6], [-2.4, -2.6], [2.2, 2.6], [4.6, 1.8], [-4.4, -0.8], [0.6, -3.8], [-1.2, 3.6]];
  const pinos = posicoes.map(([x, z], i) => {
    const p = montarPino(cores[i]);
    p.position.set(x, 0, z);
    p.scale.setScalar(reduzido ? 1 : 0.001);
    mundo.add(p);
    return p;
  });

  let largura = 0;
  function ajustar() {
    const w = recipiente.clientWidth;
    const h = recipiente.clientHeight;
    if (!w || !h) return;
    largura = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em tela estreita, afasta a câmera para caber a bomba e o selo
    const distancia = camera.aspect < 0.9 ? 13.5 : camera.aspect < 1.3 ? 11 : 9.6;
    camera.position.set(distancia * 0.5, 4.6, distancia * 0.86);
    camera.lookAt(alvo);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => {
    ajustar();
    if (reduzido) renderer.render(cena, camera);
  }).observe(recipiente);
  ajustar();

  if (reduzido) {
    desenhar(NOTA, AVALIACOES);
    mundo.rotation.y = -0.18;
    renderer.render(cena, camera);
    // as fontes do visor podem chegar depois do primeiro desenho
    document.fonts?.ready.then(() => {
      desenhar(NOTA, AVALIACOES);
      renderer.render(cena, camera);
    });
    return;
  }

  // Ponteiro inclina a cena de leve
  const ponteiro = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    ponteiro.x = (e.clientX / innerWidth) * 2 - 1;
    ponteiro.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let visivel = true;
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (visivel) requestAnimationFrame(quadro);
  }).observe(recipiente);

  const relogio = new THREE.Clock();
  let ultimoValor = -1;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const pop = (x) => (x <= 0 ? 0.001 : x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));

  function quadro() {
    if (!visivel) return;
    const t = relogio.getElapsedTime();

    // O visor conta de 0 até a nota, como o contador de litros
    const progresso = easeOut(Math.min(Math.max((t - 0.5) / 2.2, 0), 1));
    const valor = Math.round(NOTA * progresso * 10) / 10;
    if (valor !== ultimoValor) {
      desenhar(valor, Math.round(AVALIACOES * progresso));
      ultimoValor = valor;
    }

    pinos.forEach((p, i) => {
      const s = pop((t - 1.2 - i * 0.16) / 0.6);
      p.scale.setScalar(Math.max(s, 0.001));
      p.position.y = s >= 1 ? Math.sin(t * 1.6 + i) * 0.05 : 0;
    });
    const sEscala = pop((t - 2.6) / 0.7);
    selo.scale.setScalar(Math.max(sEscala, 0.001));
    selo.rotation.y = Math.sin(t * 0.9) * 0.35;
    selo.position.y = 4.35 + Math.sin(t * 1.3) * 0.08;

    const giroAlvo = -0.25 + Math.sin(t * 0.22) * 0.18 + ponteiro.x * 0.35;
    mundo.rotation.y += (giroAlvo - mundo.rotation.y) * 0.05;
    mundo.rotation.x += (ponteiro.y * 0.05 - mundo.rotation.x) * 0.05;

    if (largura) renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

/* ---------- Página ---------- */
iniciarCena();

if (!reduzido) {
  // A faixa da rodovia se preenche conforme a rolagem
  scroll(animate('.faixa-progresso', { scaleY: [0, 1] }, { ease: 'linear' }));

  // O cupom "sai da impressora" quando aparece
  const papel = document.querySelector('.cupom-papel');
  papel.style.clipPath = 'inset(0 0 100% 0)';
  inView('.cupom', () => {
    animate(papel, { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] }, { duration: 1.6, ease: [0.3, 0, 0.2, 1] });
  }, { amount: 0.3 });
}
