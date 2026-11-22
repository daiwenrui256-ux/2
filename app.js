const scene = document.querySelector('#scene');
const canvas = document.querySelector('#particleCanvas');
const context = canvas.getContext('2d', { alpha: true });
const photoLayer = document.querySelector('#photoLayer');
const scatterButton = document.querySelector('#scatterButton');
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
  './assets/photos/photo-01.jpg', './assets/photos/photo-02.jpg',
  './assets/photos/photo-03.jpg', './assets/photos/photo-04.jpg',
  './assets/photos/photo-05.jpg', './assets/photos/photo-06.jpg',
  './assets/photos/photo-07.jpg', './assets/photos/photo-08.jpg',
];
const foliageStops = [
  { at: 0, color: [255, 91, 177] },
  { at: 0.2, color: [166, 92, 227] },
  { at: 0.42, color: [85, 139, 238] },
  { at: 0.61, color: [52, 205, 217] },
  { at: 0.8, color: [45, 194, 122] },
  { at: 1, color: [10, 65, 43] },
];
const ornamentColors = ['#fff1ca', '#ffd275', '#ff719f', '#9fe8ff', '#e6b0ff'];
let width = 0;
let height = 0;
let pixelRatio = 1;
let particles = [];
let skyStars = [];
let scattered = false;
let yaw = 0;
let pitch = 0;
let zoom = 1;
let rotationPaused = false;
let hudHidden = false;
let previousFrameTime = 0;
let lastDetectionTime = 0;
let pointerDown = null;
let cameraStream = null;
let handLandmarker = null;
let renderRequest = 0;
let handRequest = 0;
let lastVideoTime = -1;
let pinchTarget = null;
let suppressPinchUntilRelease = false;
let lastGesture = '';
let handRotation = null;
let noticeTimer = 0;
let photoDrag = null;

function notify(message, duration) {
  status.textContent = message;
  status.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => status.classList.remove('show'), duration || 2100);
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
  scatterButton.innerHTML = scattered ? '粒子与照片归树 <span>✦</span>' : '粒子与照片散开 <span>✦</span>';
  if (scattered) {
    const radiusX = Math.min(43, Math.max(30, width / height * 28));
    photos.forEach(function(item, index) {
      const angle = -Math.PI / 2 + Math.PI * 2 * index / photos.length;
      const radius = 0.9 + (index % 3) * 0.045;
      item.position = {
        x: 50 + Math.cos(angle) * radiusX * radius,
        y: 52 + Math.sin(angle) * 35 * radius,
        tilt: (index % 2 ? 1 : -1) * (4 + index % 4),
      };
      applyPhotoPosition(item);
    });
    notify('粒子与照片同时散开');
  } else {
    showTreePhotoPositions(true);
    notify('粒子与照片回到圣诞树');
  }
}

function treeMetrics() {
  const treeHeight = Math.min(height * 0.58, 700);
  return {
    treeHeight: treeHeight,
    treeWidth: Math.min(width * 0.68, treeHeight * 0.94),
    top: height * 0.24,
    centerX: width * 0.5,
  };
}
function colorAtHeight(value, variation) {
  const h = Math.max(0, Math.min(1, value));
  let upper = foliageStops[foliageStops.length - 1];
  let lower = foliageStops[0];
  for (let i = 0; i < foliageStops.length - 1; i++) {
    if (h >= foliageStops[i].at && h <= foliageStops[i + 1].at) {
      lower = foliageStops[i];
      upper = foliageStops[i + 1];
      break;
    }
  }
  const amount = (h - lower.at) / Math.max(0.0001, upper.at - lower.at);
  const rgb = lower.color.map(function(channel, index) {
    return Math.max(0, Math.min(255, Math.round(channel + (upper.color[index] - channel) * amount + (variation || 0))));
  });
  return 'rgb(' + rgb.join(',') + ')';
}
function shapePoint(particle) {
  const metrics = treeMetrics();
  const treeHeight = metrics.treeHeight;
  const treeWidth = metrics.treeWidth;
  const top = metrics.top;
  const centerX = metrics.centerX;
  const h = particle.h;
  const branchWave = Math.sin((h * 7 % 1) * Math.PI);
  const radius = (0.025 + h * 0.47 + branchWave * 0.028) * treeWidth * particle.radial;
  const angle = particle.angle + (particle.spiral ? h * Math.PI * 12 : 0) + Math.sin(particle.phase) * 0.018;
  const x3 = Math.cos(angle) * radius;
  const z3 = Math.sin(angle) * radius;
  const turnedX = Math.cos(yaw) * x3 - Math.sin(yaw) * z3;
  const turnedZ = Math.sin(yaw) * x3 + Math.cos(yaw) * z3;
  const vertical = (h - 0.5) * treeHeight;
  const pitchedY = vertical * Math.cos(pitch) - turnedZ * Math.sin(pitch);
  const depth = vertical * Math.sin(pitch) + turnedZ * Math.cos(pitch);
  const perspective = zoom * (1 + depth / Math.max(1, treeWidth * 2.8));
  return {
    x: centerX + turnedX * perspective,
    y: top + treeHeight * 0.5 + pitchedY * perspective,
    depth: depth / Math.max(1, treeWidth),
  };
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
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const particleLimit = cores <= 4 || memory <= 4 ? 1500 : cores <= 8 || memory <= 8 ? 2200 : 3000;
  const particleCount = Math.min(particleLimit, Math.max(900, Math.round(width * height / 520)));
  for (let i = 0; i < particleCount; i++) {
    const h = Math.random();
    const spiral = Math.random() < 0.48;
    const particle = {
      h: h,
      radial: spiral ? 0.84 + Math.random() * 0.16 : Math.sqrt(Math.random()),
      angle: spiral ? Math.floor(Math.random() * 6) * Math.PI / 3 + (Math.random() - 0.5) * 0.12 : Math.random() * Math.PI * 2,
      spiral: spiral,
      phase: Math.random() * Math.PI * 2,
      size: 1.05 + Math.random() * 2.5,
      shimmer: 0.62 + Math.random() * 0.38,
      color: Math.random() < 0.095
        ? ornamentColors[Math.floor(Math.random() * ornamentColors.length)]
        : colorAtHeight(h, Math.round((Math.random() - 0.5) * 20)),
      glow: Math.random() < 0.07,
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
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const devicePixelCap = cores <= 4 || memory <= 4 ? 1.1 : 1.35;
  pixelRatio = Math.min(window.devicePixelRatio || 1, devicePixelCap);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  buildSkyStars();
  if (particles.length) {
    particles.forEach(function(particle) {
      const point = scattered ? randomCloudPoint(particle) : shapePoint(particle);
      particle.x = point.x;
      particle.y = point.y;
    });
  } else buildParticles();
  if (!scattered) showTreePhotoPositions(false);
}
function buildSkyStars() {
  const starCount = Math.max(90, Math.min(240, Math.round(width * height / 9000)));
  skyStars = Array.from({ length: starCount }, function() {
    return { x: Math.random() * width, y: Math.random() * height, size: 0.35 + Math.random() * 1.25, phase: Math.random() * Math.PI * 2 };
  });
}
function drawSkyStars(time) {
  context.save();
  context.fillStyle = '#dce7ff';
  skyStars.forEach(function(star) {
    const shimmer = 0.22 + (0.68 + 0.32 * Math.sin(time * 0.0007 + star.phase)) * 0.58;
    context.globalAlpha = shimmer;
    context.beginPath();
    context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}
function drawFrame(time) {
  if (previousFrameTime && time - previousFrameTime < 32) {
    renderRequest = requestAnimationFrame(drawFrame);
    return;
  }
  const delta = previousFrameTime ? Math.min(50, time - previousFrameTime) : 16;
  previousFrameTime = time;
  if (!rotationPaused && !pointerDown && !scattered) yaw += delta * 0.000065;
  context.clearRect(0, 0, width, height);
  drawSkyStars(time);
  const glow = context.createRadialGradient(width * .5, height * .58, 10, width * .5, height * .58, Math.min(width, height) * .42);
  glow.addColorStop(0, 'rgba(86,224,207,.065)');
  glow.addColorStop(0.45, 'rgba(143,88,222,.04)');
  glow.addColorStop(1, 'rgba(255,108,187,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  drawTreeSilhouette();
  drawTreeBoughs(time);
  context.save();
  if (!scattered) {
    const metrics = treeMetrics();
    const treeHeight = metrics.treeHeight;
    const treeWidth = metrics.treeWidth;
    const top = metrics.top;
    const centerX = metrics.centerX;
    context.beginPath();
    context.moveTo(centerX, top);
    context.lineTo(centerX - treeWidth * 0.52, top + treeHeight);
    context.lineTo(centerX + treeWidth * 0.52, top + treeHeight);
    context.closePath();
    context.clip();
  }
  context.globalCompositeOperation = 'lighter';
  const travel = 1 - Math.exp(-delta * 0.0033);
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    let target;
    if (scattered) target = randomCloudPoint(particle);
    else target = shapePoint(particle);
    particle.vx *= .92;
    particle.vy *= .92;
    particle.x += particle.vx + (target.x - particle.x) * travel;
    particle.y += particle.vy + (target.y - particle.y) * travel;
    const twinkle = .72 + .28 * Math.sin(time * .0017 + particle.phase);
    const radius = particle.size * (1 + Math.sin(time * .0012 + particle.phase) * .12);
    if (particle.glow) {
      context.globalAlpha = particle.shimmer * twinkle * 0.18;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, radius * 2.3, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = particle.shimmer * twinkle * (scattered ? .96 : 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  drawTopStar();
  renderRequest = requestAnimationFrame(drawFrame);
}
function drawTreeSilhouette() {
  const metrics = treeMetrics();
  const treeHeight = metrics.treeHeight;
  const treeWidth = metrics.treeWidth;
  const top = metrics.top;
  const centerX = metrics.centerX;
  const baseY = top + treeHeight;
  const halfWidth = treeWidth * 0.52;
  const foliage = context.createLinearGradient(centerX, top, centerX, baseY);
  foliage.addColorStop(0, 'rgba(255, 88, 181, .16)');
  foliage.addColorStop(0.22, 'rgba(160, 92, 221, .17)');
  foliage.addColorStop(0.46, 'rgba(67, 155, 222, .15)');
  foliage.addColorStop(0.7, 'rgba(37, 189, 142, .16)');
  foliage.addColorStop(1, 'rgba(14, 69, 44, .24)');
  context.save();
  context.globalAlpha = scattered ? 0.08 : 1;
  context.beginPath();
  context.moveTo(centerX, top);
  context.lineTo(centerX - halfWidth, baseY);
  context.lineTo(centerX + halfWidth, baseY);
  context.closePath();
  context.fillStyle = foliage;
  context.fill();
  context.lineWidth = 1.2;
  context.strokeStyle = 'rgba(108, 223, 216, .38)';
  context.shadowBlur = 8;
  context.shadowColor = 'rgba(94, 206, 228, .18)';
  context.stroke();
  const trunkWidth = Math.max(12, treeWidth * 0.082);
  const trunkHeight = treeHeight * 0.17;
  const trunkTop = baseY - trunkHeight * 0.92;
  const trunk = context.createLinearGradient(centerX - trunkWidth * 0.5, trunkTop, centerX + trunkWidth * 0.5, baseY);
  trunk.addColorStop(0, 'rgba(255, 96, 183, .7)');
  trunk.addColorStop(0.34, 'rgba(150, 115, 240, .66)');
  trunk.addColorStop(0.68, 'rgba(64, 208, 205, .72)');
  trunk.addColorStop(1, 'rgba(35, 122, 80, .7)');
  context.fillStyle = trunk;
  context.shadowBlur = 7;
  context.shadowColor = 'rgba(112, 220, 221, .3)';
  context.fillRect(centerX - trunkWidth * 0.5, trunkTop, trunkWidth, trunkHeight);
  context.restore();
}
function drawTreeBoughs(time) {
  const metrics = treeMetrics();
  const treeHeight = metrics.treeHeight;
  const treeWidth = metrics.treeWidth;
  const top = metrics.top;
  const centerX = metrics.centerX;
  const treeAlpha = scattered ? 0.08 : 1;
  context.save();
  context.globalAlpha = treeAlpha * 0.78;
  context.lineCap = 'round';
  for (let tier = 0; tier < 8; tier++) {
    const h = 0.11 + tier * 0.112;
    const radius = (0.035 + h * 0.47) * treeWidth;
    const rowY = top + h * treeHeight;
    const color = colorAtHeight(h + 0.04, 7);
    const blink = 0.72 + 0.28 * Math.sin(time * 0.001 + tier * 0.9);
    context.globalAlpha = treeAlpha * 0.42 * blink;
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 0;
    context.lineWidth = Math.max(1.25, 3.3 - tier * 0.18);
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(centerX, rowY - 4);
      context.quadraticCurveTo(centerX + side * radius * 0.46, rowY + 5, centerX + side * radius, rowY + 23);
      context.stroke();
      for (let sprig = 1; sprig <= 5; sprig++) {
        const t = sprig / 6;
        const branchX = centerX + side * radius * t;
        const branchY = rowY + 3 + t * 15;
        context.beginPath();
        context.moveTo(branchX, branchY);
        context.quadraticCurveTo(branchX + side * 7, branchY + 2, branchX + side * 12, branchY + 10);
        context.stroke();
      }
    }
  }
  context.restore();
}
function drawTopStar() {
  const metrics = treeMetrics();
  const x = metrics.centerX;
  const y = metrics.top - 12;
  const pulse = 1 + Math.sin(performance.now() * .002) * .12;
  context.save();
  context.translate(x, y);
  context.scale(pulse, pulse);
  context.globalAlpha = scattered ? 0.12 : 1;
  context.shadowBlur = 31;
  context.shadowColor = '#ff62bd';
  context.fillStyle = '#ff8bce';
  context.beginPath();
  context.moveTo(0, 10);
  context.bezierCurveTo(-4, 7, -15, 0, -14, -8);
  context.bezierCurveTo(-13, -17, -3, -17, 0, -9);
  context.bezierCurveTo(4, -18, 15, -16, 15, -7);
  context.bezierCurveTo(15, 0, 5, 7, 0, 10);
  context.fill();
  context.shadowBlur = 10;
  context.fillStyle = '#fff0fb';
  context.beginPath();
  context.arc(-4, -8, 2.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function saveSceneImage() {
  const frame = document.createElement('canvas');
  frame.width = Math.round(width * pixelRatio);
  frame.height = Math.round(height * pixelRatio);
  const frameContext = frame.getContext('2d');
  frameContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  frameContext.fillStyle = '#05070d';
  frameContext.fillRect(0, 0, width, height);
  frameContext.drawImage(canvas, 0, 0, width, height);
  frameContext.save();
  frameContext.textAlign = 'center';
  frameContext.fillStyle = '#f7edda';
  frameContext.shadowColor = 'rgba(255, 142, 207, .35)';
  frameContext.shadowBlur = 22;
  frameContext.font = '500 30px Georgia, serif';
  frameContext.fillText('MERRY CHRISTMAS', width * 0.5, Math.max(48, height * 0.105));
  frameContext.restore();
  photos.forEach(function(item) {
    const image = item.card.querySelector('img');
    const rect = item.card.getBoundingClientRect();
    const x = rect.left + rect.width * 0.5;
    const y = rect.top + rect.height * 0.5;
    const cardWidth = rect.width;
    const cardHeight = rect.height;
    frameContext.save();
    frameContext.translate(x, y);
    frameContext.rotate(item.position.tilt * Math.PI / 180);
    frameContext.fillStyle = '#d3ab64';
    frameContext.fillRect(-cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight);
    frameContext.fillStyle = '#090910';
    frameContext.fillRect(-cardWidth * 0.5 + 4, -cardHeight * 0.5 + 4, cardWidth - 8, cardHeight - 18);
    if (image.complete && image.naturalWidth) {
      const maxWidth = cardWidth - 8;
      const maxHeight = cardHeight - 18;
      const fit = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * fit;
      const drawHeight = image.naturalHeight * fit;
      frameContext.drawImage(image, -drawWidth * 0.5, -cardHeight * 0.5 + 4 + (maxHeight - drawHeight) * 0.5, drawWidth, drawHeight);
    }
    frameContext.fillStyle = '#fff0ca';
    frameContext.beginPath();
    frameContext.arc(0, -cardHeight * 0.5, 3.4, 0, Math.PI * 2);
    frameContext.fill();
    frameContext.restore();
  });
  frame.toBlob(function(blob) {
    if (!blob) { notify('截图没有生成，请重试'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'winter-memories.png';
    link.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    notify('圣诞树与照片已保存');
  }, 'image/png');
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
  const indexUp = extended(landmarks, 8, 6);
  const middleUp = extended(landmarks, 12, 10);
  const ringUp = extended(landmarks, 16, 14);
  const pinkyUp = extended(landmarks, 20, 18);
  const up = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
  if (distance(landmarks[4], landmarks[8]) < .065) return 'pinch';
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'point';
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
  if (!handLandmarker || cameraVideo.readyState < 2) { handRequest = requestAnimationFrame(handFrame); return; }
  const detectionTime = performance.now();
  if (cameraVideo.currentTime !== lastVideoTime && detectionTime - lastDetectionTime >= 66) {
    lastVideoTime = cameraVideo.currentTime;
    lastDetectionTime = detectionTime;
    const result = handLandmarker.detectForVideo(cameraVideo, detectionTime);
    const hand = result.landmarks && result.landmarks[0];
    if (hand) {
      const rect = scene.getBoundingClientRect();
      const x = rect.left + (1 - hand[8].x) * rect.width;
      const y = rect.top + hand[8].y * rect.height;
      cursor.style.display = 'block';
      cursor.style.left = (x - rect.left) + 'px';
      cursor.style.top = (y - rect.top) + 'px';
      const gesture = readGesture(hand);
      const fingerGap = distance(hand[4], hand[8]);
      if (!photoBackdrop.hidden) {
        if (fingerGap < .065) {
          closePhoto();
          suppressPinchUntilRelease = true;
          lastGesture = 'pinch';
          notify('照片已缩小');
        }
      } else if (suppressPinchUntilRelease) {
        if (fingerGap > .14) {
          suppressPinchUntilRelease = false;
          lastGesture = gesture;
        }
      } else if (pinchTarget && fingerGap > .14) {
        pinchTarget.card.classList.remove('dragging');
        openPhoto(pinchTarget);
        pinchTarget = null;
        lastGesture = 'spread';
        notify('照片已放大');
      } else {
        if (gesture === 'point' && !pinchTarget) {
          if (!handRotation) handRotation = { x: x, y: y, yaw: yaw, pitch: pitch };
          else {
            yaw = handRotation.yaw + (x - handRotation.x) * .006;
            pitch = Math.max(-.62, Math.min(.62, handRotation.pitch + (y - handRotation.y) * .004));
          }
        } else handRotation = null;
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
          if (gesture === 'fist') pinchTarget = null;
        }
      }
    } else {
      cursor.style.display = 'none';
      if (pinchTarget) { pinchTarget.card.classList.remove('dragging'); pinchTarget = null; }
      handRotation = null;
      lastGesture = '';
    }
  }
  handRequest = requestAnimationFrame(handFrame);
}
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    notify(window.isSecureContext
      ? '当前浏览器没有开放摄像头接口，请在 Chrome 或 Edge 中打开网页'
      : '摄像头需要在 HTTPS 页面中使用，请用浏览器打开此网页', 6000);
    return;
  }
  cameraButton.disabled = true;
  cameraLabel.textContent = '正在连接摄像头…';
  let cameraGranted = false;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 }, audio: false });
    cameraGranted = true;
    cameraVideo.srcObject = cameraStream;
    cameraPreview.hidden = false;
    await cameraVideo.play();
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    const options = { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 };
    try { handLandmarker = await vision.HandLandmarker.createFromOptions(files, options); }
    catch { handLandmarker = await vision.HandLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: options.baseOptions.modelAssetPath, delegate: 'CPU' } }); }
    cameraButton.classList.add('is-on');
    cameraButton.disabled = false;
    cameraLabel.textContent = '关闭手势互动';
    notify('单指移动旋转圣诞树 · 两指捏合选择照片，张开两指放大，再捏合收起');
    handRequest = requestAnimationFrame(handFrame);
  } catch (error) {
    stopCamera();
    cameraButton.disabled = false;
    cameraLabel.textContent = '开启手势互动';
    if (!cameraGranted && error && error.name === 'NotAllowedError') {
      notify('浏览器拦截了摄像头：点地址栏左侧图标，在“站点权限”里将摄像头改为允许，然后刷新', 8000);
    } else if (!cameraGranted && error && error.name === 'NotFoundError') {
      notify('没有检测到可用摄像头，请检查设备连接', 6000);
    } else if (!cameraGranted && error && error.name === 'NotReadableError') {
      notify('摄像头正在被其他应用占用，请先关闭其他视频应用', 6000);
    } else if (cameraGranted) {
      notify('摄像头已授权，但手势组件没有加载成功；请检查网络后重试', 6500);
    } else {
      notify('摄像头启动失败：请在浏览器站点设置中允许摄像头，再重试', 6500);
    }
  }
}
function stopCamera() {
  cancelAnimationFrame(handRequest);
  handRequest = 0;
  if (handLandmarker) handLandmarker.close();
  handLandmarker = null;
  if (cameraStream) cameraStream.getTracks().forEach(function(track) { track.stop(); });
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraPreview.hidden = true;
  cursor.style.display = 'none';
  pinchTarget = null;
  suppressPinchUntilRelease = false;
  handRotation = null;
  lastGesture = '';
  cameraButton.classList.remove('is-on');
  cameraLabel.textContent = '开启手势互动';
}
cameraButton.addEventListener('click', function() { if (cameraStream) stopCamera(); else startCamera(); });
scatterButton.addEventListener('click', function() { setScattered(!scattered); });
document.querySelector('#photoClose').addEventListener('click', closePhoto);
photoBackdrop.addEventListener('click', function(event) { if (event.target === photoBackdrop) closePhoto(); });
window.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') { closePhoto(); return; }
  if (event.target.closest && event.target.closest('button')) return;
  const key = event.key.toLowerCase();
  if (event.code === 'Space') {
    event.preventDefault();
    rotationPaused = !rotationPaused;
    notify(rotationPaused ? '已暂停树的旋转' : '树继续缓缓旋转');
  } else if (key === 'f') {
    yaw = 0;
    pitch = 0;
    zoom = 1;
    notify('视角已复位');
  } else if (key === 's') {
    saveSceneImage();
  } else if (key === 'h') {
    hudHidden = !hudHidden;
    scene.classList.toggle('hud-hidden', hudHidden);
  }
});
window.addEventListener('beforeunload', function() { stopCamera(); music.pause(); });
scene.addEventListener('pointerdown', function(event) {
  if (event.target !== canvas || event.button !== 0) return;
  pointerDown = { x: event.clientX, y: event.clientY, yaw: yaw, pitch: pitch };
});
scene.addEventListener('pointermove', function(event) {
  if (pointerDown) {
    yaw = pointerDown.yaw + (event.clientX - pointerDown.x) * .006;
    pitch = Math.max(-0.62, Math.min(0.62, pointerDown.pitch + (event.clientY - pointerDown.y) * .004));
  }
});
window.addEventListener('pointerup', function() { pointerDown = null; });
scene.addEventListener('wheel', function(event) {
  event.preventDefault();
  zoom = Math.max(0.72, Math.min(1.55, zoom * (event.deltaY < 0 ? 1.07 : 0.935)));
}, { passive: false });
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

