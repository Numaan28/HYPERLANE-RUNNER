const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const groundY = canvas.height - 90;

/* ===== PLAYER ===== */
const player = {
  x: 130,
  y: groundY - 50,
  width: 50,
  height: 50,
  velocityY: 0,
  gravity: 1.3,
  jumpForce: -19,
  onGround: true,
  rotation: 0
};

/* ===== GAME STATE ===== */
let speed = 10;
let score = 0;
let running = false;
let paused = false;
let gameOver = false;

/* ===== FAR BUILDINGS ===== */
function makeBuildings(count) {
  let arr = [];
  let x = 0;
  for (let i = 0; i < count; i++) {
    const w = 140 + Math.random() * 120;
    const h = 220 + Math.random() * 180;
    arr.push({ x, w, h });
    x += w + 90;
  }
  return arr;
}
const farBuildings = makeBuildings(20);
let farX = 0;

// holes
let holes = [];
let spikes = [];
let nextHoleX = canvas.width + 500;

//  constant hole size (no tiny holes)
const HOLE_WIDTH = 170;

// random timing / difficulty tuning
function rand(min, max) { return min + Math.random() * (max - min); }

// This controls how "random" + challenging it feels.
// At higher speed we keep things fair, but still random.
// (Random land length between holes, NOT double holes.)
function getRandomLandGap() {
  // base randomness
  let minLand = 220;
  let maxLand = 520;

  // as speed increases, reduce max a bit for challenge (still random)
  const s = Math.min(speed, 60);
  maxLand -= (s - 14) * 3.0;  // gradually tighter
  minLand -= (s - 14) * 1.2;

  // safety clamp
  minLand = Math.max(160, minLand);
  maxLand = Math.max(minLand + 120, maxLand);

  // occasionally short landing space (forces quick re-jump feel, still single holes)
  if (Math.random() < 0.18) {
    return rand(160, 230);
  }

  return rand(minLand, maxLand);
}

function spawnHole() {
  const spawnSpike = Math.random() < 0.4; // 40% spike, 60% hole

  if (spawnSpike) {
    //  spawn spike only
    spikes.push({
      x: nextHoleX,
      size: 28
    });

    // give enough land after spike
    nextHoleX += 180 + rand(80, 140);

  } else {
    // spawn hole only
    holes.push({
      x: nextHoleX,
      width: HOLE_WIDTH
    });

    nextHoleX += HOLE_WIDTH + getRandomLandGap();
  }
}

/* ===== BACKGROUND ===== */
function drawBackground() {
  ctx.fillStyle = "#8FD3FF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(canvas.width - 150, 120, 45, 0, Math.PI * 2);
  ctx.fillStyle = "#FFD54F";
  ctx.fill();

  farX -= speed * 0.06;
  farBuildings.forEach(b => {
    let x = b.x + farX;
    const loop = farBuildings[farBuildings.length - 1].x + 700;
    while (x + b.w < 0) x += loop;

    ctx.fillStyle = "#9FB0C3";
    ctx.fillRect(x, groundY - b.h, b.w, b.h);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let y = groundY - b.h + 30; y < groundY - 20; y += 40) {
      for (let wx = x + 20; wx < x + b.w - 25; wx += 35) {
        ctx.fillRect(wx, y, 14, 8);
      }
    }
  });
}

/* ===== PLAYER ===== */
function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + 25, player.y + player.height / 2);
  ctx.rotate(player.rotation);

  ctx.fillStyle = "#4CAF50";
  ctx.fillRect(-25, -player.height / 2, 50, player.height);

  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(-10, -8, 4, 0, Math.PI * 2);
  ctx.arc(10, -8, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-2, -2, 4, 6);
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.arc(0, 6, 10, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}


//  This prevents "hole skips under player at high speed"
// We check if the hole crossed the player's X-range during this frame.
function isPlayerOverAnyHoleSwept(dx) {
  const pL = player.x;
  const pR = player.x + player.width;

  for (const h of holes) {
    const prevL = h.x;
    const prevR = h.x + h.width;
    const newL  = h.x - dx;
    const newR  = (h.x - dx) + h.width;

    const sweptL = Math.min(prevL, newL);
    const sweptR = Math.max(prevR, newR);

    if (pR > sweptL && pL < sweptR) return true;
  }
  return false;
}

/* ===== GAME LOOP ===== */
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (running && !paused && !gameOver) {
    
    score += speed * 0.08;

    // move holes first (so swept check uses correct dx)
    const holeDx = speed * 0.7;
    holes.forEach(h => h.x -= holeDx);
    spikes.forEach(s => s.x -= holeDx);


    // spawn logic (random gaps handled inside spawnHole)
    if (!holes.length) {
      spawnHole();
    } else {
      // keep enough buffer ahead
      const last = holes[holes.length - 1];
      if (last.x < canvas.width + 250) spawnHole();
    }
    holes = holes.filter(h => h.x + h.width > -200);
    spikes = spikes.filter(s => s.x + s.size > -100);


    // physics
    player.velocityY += player.gravity;
    player.y += player.velocityY;

    if (!player.onGround) player.rotation += 0.3;
    else player.rotation = 0;

    // robust "over hole" check (swept to avoid high-speed bug)
    const overHole = isPlayerOverAnyHoleSwept(holeDx);

    // ground / falling logic
    if (!overHole && player.y + player.height >= groundY) {
      player.y = groundY - player.height;
      player.velocityY = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // game over if fall below screen
    if (player.y > canvas.height + 60) {
      triggerGameOver();
    }
    // spike collision
spikes.forEach(s => {
  if (
    player.x + player.width > s.x &&
    player.x < s.x + s.size &&
    player.y + player.height >= groundY - s.size
  ) {
    triggerGameOver();
  }
});

  }

  // draw ground segments with holes
  ctx.fillStyle = "#444";
  let lastX = 0;
  holes.forEach(h => {
    ctx.fillRect(lastX, groundY, h.x - lastX, 8);
    lastX = h.x + h.width;
  });

  ctx.fillRect(lastX, groundY, canvas.width - lastX, 8);
  // draw spikes
ctx.fillStyle = "#D32F2F";
spikes.forEach(s => {
  ctx.beginPath();
  ctx.moveTo(s.x, groundY);
  ctx.lineTo(s.x + s.size / 2, groundY - s.size);
  ctx.lineTo(s.x + s.size, groundY);
  ctx.closePath();
  ctx.fill();
});


  drawPlayer();
  document.getElementById("score").innerText = Math.floor(score);

  requestAnimationFrame(loop);
}

/* ===== GAME FLOW ===== */
function triggerGameOver() {
  gameOver = true;
  running = false;
  paused = false;
  document.getElementById("pauseMenu").style.display = "none";
  document.getElementById("gameOverMenu").style.display = "flex";
}

function startGame() {
  reset();
  running = true;
  paused = false;
  gameOver = false;
  hideMenus();
}

function restartGame() {
  reset();
  running = true;
  paused = false;
  gameOver = false;
  hideMenus();
}

function resumeGame() {
  if (!running || gameOver) return;
  paused = false;
  document.getElementById("pauseMenu").style.display = "none";
}

function goToMenu() {
  running = false;
  paused = false;
  gameOver = false;
  hideMenus();
  document.getElementById("mainMenu").style.display = "flex";
}

function hideMenus() {
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("pauseMenu").style.display = "none";
  document.getElementById("gameOverMenu").style.display = "none";
}

function reset() {
  speed = 10;
  score = 0;
  holes = [];
  spikes = [];

  nextHoleX = canvas.width + 500;

  // spawn a couple ahead so start feels smooth + random already
  spawnHole();
  spawnHole();

  player.y = groundY - player.height;
  player.velocityY = 0;
  player.onGround = true;
  player.rotation = 0;
}

/* ===== INPUT ===== */
function tryJump() {
  if (running && !paused && !gameOver && player.onGround) {
    player.velocityY = player.jumpForce;
    player.onGround = false;
  }
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  document.getElementById("pauseMenu").style.display = paused ? "flex" : "none";
}

window.addEventListener("keydown", e => {
  const jumpKeys = ["w", "W", " ", "ArrowUp"];
  if (jumpKeys.includes(e.key)) {
    e.preventDefault();
    tryJump();
  }

  // P to pause/resume
  if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    togglePause();
  }
}, { passive: false });

//  Mobile tap to jump
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  tryJump();
}, { passive: false });


/* ===== START ===== */
document.getElementById("mainMenu").style.display = "flex";
requestAnimationFrame(loop);

