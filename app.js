const scene = document.querySelector('#scene');
const canvas = document.querySelector('#particleCanvas');
const context = canvas.getContext('2d', { alpha: true });
const photoLayer = document.querySelector('#photoLayer');
const cameraButton = document.querySelector('#cameraButton');
const cameraLabel = document.querySelector('#cameraLabel');
const cameraVideo = document.querySelector('#cameraVideo');
const cameraPreview = document.querySelector('#cameraPreview');
const cursor = document.querySelector('#gestureCursor');
const music = document.querySelector('#musicSource');
const musicToggle = document.querySelector('#musicToggle');
const musicLabel = document.querySelector('#musicLabel');
const status = document.querySelector('#gestureStatus');
const photoBackdrop = document.querySelector('#photoBackdrop');
const enlargedPhoto = document.querySelector('#enlargedPhoto');
const photos = [];
const initialSlots = [
  { x: 37, y: 31, tilt: -7 }, { x: 63, y: 31, tilt: 6 },
  { x: 31, y: 42, tilt: 5 }, { x: 69, y: 42, tilt: -6 },
  { x: 34, y: 54, tilt: -5 }, { x: 66, y: 54, tilt: 7 },
  { x: 42, y: 65, tilt: 5 }, { x: 58, y: 65, tilt: -4 },
];
const photoFiles = [
  '/assets/photos/photo-01.jpg', '/assets/photos/photo-02.jpg',
  '/assets/photos/photo-03.jpg', '/assets/photos/photo-04.jpg',
  '/assets/photos/photo-05.jpg', '/assets/photos/photo-06.jpg',
  '/assets/photos/photo-07.jpg', '/assets/photos/photo-08.jpg',
];
const colors = ['#ffe4a0', '#ffcc72', '#f5ae59', '#fff0c6', '#f18383', '#d9a8e5', '#dbefdc'];
const particleCount = 2800;
let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let scattered = false;
let yaw = 0;
let pointerDown = null;
let cameraStream = null;
let handLandmarker = null;
let frameRequest = 0;
let lastVideoTime = -1;
let pinchTarget = null;
let lastGesture = '';
let noticeTimer = 0;
let photoDrag = null;

function notify(message) {
  status.textContent = message;
  status.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => status.classList.remove('show'), 2100);
}

function createPhotoCard(source, index) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'photo-card';
  card.setAttribute('aria-label', '打开第' + (index + 1) + '张照片');
  card.dataset.photoIndex = String(index);
  const image = document.createElement('img');
  image.alt = '个人照片';
  image.draggable = false;
  image.addEventListener('load', function() {
    const ratio = image.naturalWidth / image.naturalHeight;
    card.style.aspectRatio = Math.max(.68, Math.min(1.7, ratio)).toFixed(3) + ' / 1';
  });
  image.src = source;
  card.append(image);
  const pos = Object.assign({}, initialSlots[index]);
  const item = { index: index, card: card, position: pos };
  photos.push(item);
  applyPhotoPosition(item);
  card.addEventListener('pointerdown', onPhotoDown);
  card.addEventListener('pointermove', onPhotoMove);
  card.addEventListener('pointerup', onPhotoUp);
  card.addEventListener('pointercancel', onPhotoUp);
  card.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPhoto(item);
    }
  });
  photoLayer.append(card);
}
function applyPhotoPosition(item) {
  item.card.style.setProperty('--x', item.position.x + '%');
  item.card.style.setProperty('--y', item.position.y + '%');
  item.card.style.setProperty('--tilt', item.position.tilt + 'deg');
}
function showTreePhotoPositions(animate) {
  photos.forEach(function(item, index) {
    const slot = initialSlots[index];
    item.position = Object.assign({}, slot);
    if (!animate) item.card.style.transition = 'none';
    applyPhotoPosition(item);
    if (!animate) requestAnimationFrame(function() { item.card.style.transition = ''; });
  });
}
function setScattered(value) {
  if (scattered === value) return;
  scattered = value;
  scene.classList.toggle('is-scattered', scattered);
  if (scattered) {
    const radiusX = Math.min(39, Math.max(30, width / height * 25));
    photos.forEach(function(item, index) {
      const angle = -Math.PI / 2 + Math.PI * 2 * index / photos.length;
      item.position = {
        x: 50 + Math.cos(angle) * radiusX,
        y: 52 + Math.sin(angle) * 32,
        tilt: (index % 2 ? 1 : -1) * (4 + index % 4),
      };
      applyPhotoPosition(item);
    });
    notify('粒子与照片，随手势散开');
  } else {
    showTreePhotoPositions(true);
    notify('照片回到圣诞树');
  }
}

function shapePoint(particle) {
  const treeHeight = Math.min(height * 0.66, 570);
  const treeWidth = Math.min(width * 0.57, treeHeight * 0.82);
  const top = height * 0.2;
  const centerX = width * 0.5;
  const h = particle.h;
  const radius = (0.025 + h * 0.49) * treeWidth * particle.radial;
  const angle = particle.angle + yaw + Math.sin(particle.phase) * 0.018;
  const x3 = Math.cos(angle) * radius;
  const z3 = Math.sin(angle) * radius;
  return { x: centerX + x3, y: top + h * treeHeight + z3 * treeWidth * 0.11, depth: z3 / Math.max(1, treeWidth) };
}
function randomCloudPoint(particle) {
  const angle = particle.angle * 1.7 + particle.phase;
  const radius = Math.sqrt(particle.radial);
  return {
    x: width * 0.5 + Math.cos(angle) * radius * width * 0.44,
    y: height * 0.54 + Math.sin(angle) * radius * height * 0.37,
  };
}
function buildParticles() {
  particles = [];
  for (let i = 0; i < particleCount; i++) {
    const particle = {
      h: Math.random(),
      radial: Math.sqrt(Math.random()),
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      size: 0.65 + Math.random() * 2.2,
      shimmer: 0.45 + Math.random() * 0.55,
      color: colors[Math.floor(Math.random() * colors.length)],
      x: 0, y: 0, vx: 0, vy: 0,
    };
    const point = shapePoint(particle);
    particle.x = point.x;
    particle.y = point.y;
    particles.push(particle);
  }
}
function resizeCanvas() {
  const rect = scene.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (particles.length) {
    particles.forEach(function(particle) {
      const point = scattered ? randomCloudPoint(particle) : shapePoint(particle);
      particle.x = point.x;
      particle.y = point.y;
    });
  } else buildParticles();
  if (!scattered) showTreePhotoPositions(false);
}
function drawFrame(time) {
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * .5, height * .58, 10, width * .5, height * .58, Math.min(width, height) * .42);
  glow.addColorStop(0, 'rgba(255,185,90,.025)');
  glow.addColorStop(1, 'rgba(255,185,90,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    let target;
    if (scattered) target = randomCloudPoint(particle);
    else target = shapePoint(particle);
    particle.vx *= .92;
    particle.vy *= .92;
    particle.x += particle.vx + (target.x - particle.x) * (scattered ? .055 : .072);
    particle.y += particle.vy + (target.y - particle.y) * (scattered ? .055 : .072);
    const twinkle = .55 + .45 * Math.sin(time * .0017 + particle.phase);
    const radius = particle.size * (1 + Math.sin(time * .0012 + particle.phase) * .12);
    context.globalAlpha = particle.shimmer * twinkle * (scattered ? .88 : .9);
    context.fillStyle = particle.color;
    context.shadowBlur = particle.size * (scattered ? 3.4 : 2.4);
    context.shadowColor = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  drawTopStar();
  frameRequest = requestAnimationFrame(drawFrame);
}
function drawTopStar() {
  const x = width * .5;
  const y = height * .2 - 14;
  const pulse = 1 + Math.sin(performance.now() * .002) * .12;
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  context.shadowBlur = 18;
  context.shadowColor = '#ffd77a';
  context.fillStyle = '#ffe293';
  context.fillRect(-4 * pulse, -4 * pulse, 8 * pulse, 8 * pulse);
  context.restore();
}

function openPhoto(item) {
  enlargedPhoto.src = item.card.querySelector('img').src;
  photoBackdrop.hidden = false;
}
function closePhoto() {
  photoBackdrop.hidden = true;
  enlargedPhoto.removeAttribute('src');
}
function movePhotoToPoint(item, clientX, clientY) {
  const rect = scene.getBoundingClientRect();
  item.position.x = Math.max(7, Math.min(93, (clientX - rect.left) / rect.width * 100));
  item.position.y = Math.max(10, Math.min(89, (clientY - rect.top) / rect.height * 100));
  applyPhotoPosition(item);
}
function onPhotoDown(event) {
  const item = photos[Number(event.currentTarget.dataset.photoIndex)];
  if (!item) return;
  photoDrag = { item: item, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('dragging');
}
function onPhotoMove(event) {
  if (!photoDrag || photoDrag.pointer !== event.pointerId) return;
  if (Math.hypot(event.clientX - photoDrag.x, event.clientY - photoDrag.y) > 5) photoDrag.moved = true;
  if (photoDrag.moved) movePhotoToPoint(photoDrag.item, event.clientX, event.clientY);
}
function onPhotoUp(event) {
  if (!photoDrag || photoDrag.pointer !== event.pointerId) return;
  const item = photoDrag.item;
  const moved = photoDrag.moved;
  event.currentTarget.classList.remove('dragging');
  photoDrag = null;
  if (!moved) openPhoto(item);
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function extended(landmarks, tip, joint) { return landmarks[tip].y < landmarks[joint].y - .025; }
function readGesture(landmarks) {
  const up = [extended(landmarks,8,6), extended(landmarks,12,10), extended(landmarks,16,14), extended(landmarks,20,18)].filter(Boolean).length;
  if (distance(landmarks[4], landmarks[8]) < .065) return 'pinch';
  if (up >= 4) return 'open';
  if (up <= 1) return 'fist';
  return 'move';
}
function nearestPhoto(x, y) {
  let best = null;
  let bestDistance = Infinity;
  photos.forEach(function(item) {
    const rect = item.card.getBoundingClientRect();
    const d = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (d < bestDistance) { bestDistance = d; best = item; }
  });
  return bestDistance < 165 ? best : null;
}
function handFrame() {
  if (!handLandmarker || cameraVideo.readyState < 2) { frameRequest = requestAnimationFrame(handFrame); return; }
  if (cameraVideo.currentTime !== lastVideoTime) {
    lastVideoTime = cameraVideo.currentTime;
    const result = handLandmarker.detectForVideo(cameraVideo, performance.now());
    const hand = result.landmarks && result.landmarks[0];
    if (hand) {
      const rect = scene.getBoundingClientRect();
      const x = rect.left + (1 - hand[8].x) * rect.width;
      const y = rect.top + hand[8].y * rect.height;
      cursor.style.display = 'block';
      cursor.style.left = (x - rect.left) + 'px';
      cursor.style.top = (y - rect.top) + 'px';
      const gesture = readGesture(hand);
      if (gesture !== lastGesture) {
        if (gesture === 'open') setScattered(true);
        if (gesture === 'fist') setScattered(false);
        lastGesture = gesture;
      }
      if (gesture === 'pinch') {
        if (!pinchTarget) {
          const target = nearestPhoto(x, y);
          if (target) pinchTarget = target;
        }
        if (pinchTarget) {
          pinchTarget.card.classList.add('dragging');
          movePhotoToPoint(pinchTarget, x, y);
        }
      } else if (pinchTarget) {
        pinchTarget.card.classList.remove('dragging');
        pinchTarget = null;
      }
    } else {
      cursor.style.display = 'none';
      if (pinchTarget) { pinchTarget.card.classList.remove('dragging'); pinchTarget = null; }
      lastGesture = '';
    }
  }
  frameRequest = requestAnimationFrame(handFrame);
}
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    notify('请通过 localhost 或 HTTPS 打开页面以使用摄像头');
    return;
  }
  cameraButton.disabled = true;
  cameraLabel.textContent = '正在连接摄像头…';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    cameraVideo.srcObject = cameraStream;
    cameraPreview.hidden = false;
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    const options = { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 };
    try { handLandmarker = await vision.HandLandmarker.createFromOptions(files, options); }
    catch { handLandmarker = await vision.HandLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: options.baseOptions.modelAssetPath, delegate: 'CPU' } }); }
    cameraButton.classList.add('is-on');
    cameraButton.disabled = false;
    cameraLabel.textContent = '关闭手势互动';
    notify('张开手掌散开 · 握拳聚拢 · 捏合拖动照片');
    frameRequest = requestAnimationFrame(handFrame);
  } catch (error) {
    stopCamera();
    cameraButton.disabled = false;
    cameraLabel.textContent = '开启手势互动';
    notify(error && error.name === 'NotAllowedError' ? '请允许浏览器访问摄像头' : '摄像头或手势组件未能启动，请检查网络');
  }
}
function stopCamera() {
  cancelAnimationFrame(frameRequest);
  if (handLandmarker) handLandmarker.close();
  handLandmarker = null;
  if (cameraStream) cameraStream.getTracks().forEach(function(track) { track.stop(); });
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraPreview.hidden = true;
  cursor.style.display = 'none';
  pinchTarget = null;
  lastGesture = '';
  cameraButton.classList.remove('is-on');
  cameraLabel.textContent = '开启手势互动';
}
cameraButton.addEventListener('click', function() { if (cameraStream) stopCamera(); else startCamera(); });
document.querySelector('#scatterButton').addEventListener('click', function() { setScattered(!scattered); });
document.querySelector('#photoClose').addEventListener('click', closePhoto);
photoBackdrop.addEventListener('click', function(event) { if (event.target === photoBackdrop) closePhoto(); });
window.addEventListener('keydown', function(event) { if (event.key === 'Escape') closePhoto(); });
window.addEventListener('beforeunload', function() { stopCamera(); music.pause(); });
scene.addEventListener('pointerdown', function(event) {
  if (event.target !== canvas) return;
  pointerDown = { x: event.clientX, yaw: yaw };
});
scene.addEventListener('pointermove', function(event) {
  if (pointerDown) yaw = pointerDown.yaw + (event.clientX - pointerDown.x) * .006;
});
window.addEventListener('pointerup', function() { pointerDown = null; });
music.volume = .48;
musicToggle.addEventListener('click', async function() {
  try {
    if (music.paused) {
      await music.play();
      musicToggle.classList.add('is-playing');
      musicToggle.setAttribute('aria-pressed', 'true');
      musicLabel.textContent = '暂停背景音乐';
    } else {
      music.pause();
      musicToggle.classList.remove('is-playing');
      musicToggle.setAttribute('aria-pressed', 'false');
      musicLabel.textContent = '播放背景音乐';
    }
  } catch { notify('音乐未能播放，请检查浏览器对本地视频的支持'); }
});

photoFiles.forEach(createPhotoCard);
function initialize() {
  resizeCanvas();
  requestAnimationFrame(drawFrame);
}
window.addEventListener('resize', resizeCanvas);
initialize();

