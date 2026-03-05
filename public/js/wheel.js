(function () {
  const canvas = document.getElementById('wheel');
  const resultEl = document.getElementById('result');
  const ctx = canvas.getContext('2d');

  const CENTER_X = 400;
  const CENTER_Y = 400;
  const RADIUS = 360;
  const SEGMENT_PADDING = 8;

  let games = [];
  let currentRotation = 0;
  let isSpinning = false;
  let animationId = null;
  let pendingResult = null;
  let lastSegmentIdx = -1;

  const clackSound = new Audio('/clack.mp3');

  function playClack() {
    const sfx = clackSound.cloneNode();
    sfx.volume = 0.6;
    sfx.play().catch(() => {});
  }

  function getSegmentIndexAtPointer() {
    if (games.length === 0) return -1;
    const n = games.length;
    const sliceAngle = (2 * Math.PI) / n;
    const pointerAngle = -Math.PI / 2;
    const twoPi = 2 * Math.PI;
    const rotNorm = ((currentRotation % twoPi) + twoPi) % twoPi;
    const relAngle = ((pointerAngle - rotNorm) % twoPi + twoPi) % twoPi;
    return Math.floor(relAngle / sliceAngle) % n;
  }

  function getSegmentAtPointer() {
    const idx = getSegmentIndexAtPointer();
    return idx >= 0 ? games[idx] : null;
  }

  function updatePointerText() {
    const seg = getSegmentAtPointer();
    if (seg) {
      resultEl.textContent = `${seg.name} — ${seg.platform}`;
      resultEl.classList.remove('empty');
    }
  }

  function drawWheel() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (games.length === 0) {
      ctx.save();
      ctx.translate(CENTER_X, CENTER_Y);
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666';
      ctx.fillText('Add games in the management page', 0, 0);
      ctx.restore();
      return;
    }

    const n = games.length;
    const sliceAngle = (2 * Math.PI) / n;

    for (let i = 0; i < n; i++) {
      const startAngle = currentRotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(CENTER_X, CENTER_Y);
      ctx.arc(CENTER_X, CENTER_Y, RADIUS, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#e8e8e8' : '#ddd';
      ctx.fill();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const textRadius = RADIUS - SEGMENT_PADDING - 60;
      const tx = CENTER_X + Math.cos(midAngle) * textRadius;
      const ty = CENTER_Y + Math.sin(midAngle) * textRadius;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = '#333';
      const name = String(games[i].name).slice(0, 20);
      const platform = String(games[i].platform).slice(0, 12);
      ctx.fillText(name, 0, -6);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#555';
      ctx.fillText(platform, 0, 12);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function runSpinAnimation(targetSegmentIndex, totalSegments) {
    if (games.length === 0 || totalSegments === 0) return;
    const n = totalSegments;
    const sliceAngle = (2 * Math.PI) / n;
    const fullTurns = 5 + Math.floor(Math.random() * 3);
    const topAngle = -Math.PI / 2;
    const twoPi = 2 * Math.PI;
    const startMod = ((currentRotation % twoPi) + twoPi) % twoPi;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.6;
    const endRotationMod = topAngle - (targetSegmentIndex + 0.5) * sliceAngle + jitter;
    const endRotationNorm = ((endRotationMod % twoPi) + twoPi) % twoPi;
    let targetRotation = fullTurns * twoPi + (endRotationNorm - startMod);
    if (targetRotation < fullTurns * twoPi) targetRotation += twoPi;

    const duration = 6000;
    const startTime = performance.now();
    const startRotation = currentRotation;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      currentRotation = startRotation + targetRotation * eased;
      drawWheel();
      const curIdx = getSegmentIndexAtPointer();
      if (curIdx !== lastSegmentIdx) {
        playClack();
        lastSegmentIdx = curIdx;
      }
      updatePointerText();
      if (t < 1) {
        animationId = requestAnimationFrame(tick);
      } else {
        isSpinning = false;
        animationId = null;
        if (pendingResult) {
          showResult(pendingResult);
          pendingResult = null;
        }
      }
    }

    isSpinning = true;
    lastSegmentIdx = getSegmentIndexAtPointer();
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(tick);
  }

  function showResult(game) {
    resultEl.textContent = `${game.name} — ${game.platform}`;
    resultEl.classList.remove('empty');
  }

  function connectSSE() {
    const es = new EventSource('/api/spin/stream');
    es.addEventListener('state', (e) => {
      const data = JSON.parse(e.data);
      if (data.games && data.games.length > 0) {
        games = data.games;
        drawWheel();
      }
      if (data.lastSpin) {
        showResult(data.lastSpin.game);
      }
    });
    es.addEventListener('spin', (e) => {
      const data = JSON.parse(e.data);
      pendingResult = data.game;
      if (data.games && data.games.length > 0) {
        games = data.games;
      }
      runSpinAnimation(data.segmentIndex, data.totalSegments);
    });
    es.onerror = () => {
      es.close();
      setTimeout(connectSSE, 3000);
    };
  }

  connectSSE();
})();
