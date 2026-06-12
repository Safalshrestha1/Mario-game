const Audio = (() => {
  let ctx, masterGain, musicGain, sfxGain;
  let musicInt = null;

  let soundEnabled = true;
  let musicEnabled = true;

  let volume = 0.7;

  const musicNotes = [
    392, 392, 0, 392, 0, 261, 392, 0, 523, 0, 0, 0, 261, 0, 0, 0,
    220, 0, 0, 0, 246, 0, 0, 0, 233, 0, 246, 0, 220, 0, 196, 0,
    261, 0, 294, 0, 329, 0, 311, 294, 261, 0, 196, 261, 329, 392, 349, 329
  ];

  // ===================== INIT =====================
  function init() {
    if (ctx) return;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();

      masterGain.gain.value = volume;

      musicGain.gain.value = 0.18;
      sfxGain.gain.value = 0.6;

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(ctx.destination);

    } catch (e) {
      console.log("Audio init failed:", e);
    }
  }

  // ===================== CORE SOUND =====================
  function beep(freq, dur = 0.08, type = 'square', gain = 0.5, delay = 0) {
    if (!ctx || !soundEnabled) return;

    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = type;
      o.frequency.value = freq;

      const t = ctx.currentTime + delay;

      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      o.connect(g);
      g.connect(sfxGain); // ✅ FIX: proper routing

      o.start(t);
      o.stop(t + dur);
    } catch (e) {
      console.log("beep error:", e);
    }
  }

  // ===================== SFX =====================
  function playJump() {
    beep(400, 0.04, 'square', 0.4);
    beep(600, 0.08, 'square', 0.3, 0.04);
  }

  function playCoin() {
    beep(988, 0.05, 'sine', 0.5);
    beep(1319, 0.1, 'sine', 0.4, 0.05);
  }

  function playDie() {
    beep(440, 0.2, 'sawtooth', 0.5);
    beep(350, 0.2, 'sawtooth', 0.5, 0.2);
    beep(280, 0.3, 'sawtooth', 0.5, 0.4);
  }

  function playPowerup() {
    [523, 587, 659, 784].forEach((f, i) =>
      beep(f, 0.1, 'square', 0.4, i * 0.1)
    );
  }

  function playStomp() {
    beep(200, 0.05, 'square', 0.6);
    beep(150, 0.1, 'square', 0.5, 0.05);
  }

  function playFlagpole() {
    [523, 659, 784, 1047].forEach((f, i) =>
      beep(f, 0.15, 'sine', 0.4, i * 0.15)
    );
  }

  function playBrick() {
    beep(300, 0.05, 'square', 0.5);
    beep(200, 0.08, 'square', 0.4, 0.05);
  }

  function playGameOver() {
    [659, 523, 261].forEach((f, i) =>
      beep(f, 0.35, 'sawtooth', 0.6, i * 0.35)
    );
  }

  // ===================== MUSIC =====================
  function startMusic() {
    if (!ctx || !musicEnabled) return;

    let beat = 0;

    musicInt = setInterval(() => {
      const note = musicNotes[beat % musicNotes.length];

      if (note) {
        try {
          const o = ctx.createOscillator();
          const g = ctx.createGain();

          o.type = 'square';
          o.frequency.value = note;

          const t = ctx.currentTime;

          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

          o.connect(g);
          g.connect(musicGain);

          o.start(t);
          o.stop(t + 0.18);

        } catch (e) {}
      }

      beat++;
    }, 130);
  }

  function stopMusic() {
    if (musicInt) {
      clearInterval(musicInt);
      musicInt = null;
    }
  }

  // ===================== CONTROLS =====================
  function setVolume(v) {
    volume = v / 100;
    if (masterGain) masterGain.gain.value = volume;
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;

    if (!musicEnabled) stopMusic();
    else startMusic();

    return musicEnabled;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  // ===================== EXPORT =====================
  return {
    init,
    playJump,
    playCoin,
    playDie,
    playPowerup,
    playStomp,
    playFlagpole,
    playBrick,
    playGameOver,
    startMusic,
    stopMusic,
    setVolume,
    toggleSound,
    toggleMusic,
    resume
  };
})();
// ═══════════════════════════════════════════════════════════
//  GAME ENGINE
// ═══════════════════════════════════════════════════════════
const Game = (() => {

  // ── Constants ──────────────────────────────────────────
  const TILE = 32;
  const GRAVITY = 0.55;
  const MAX_FALL = 16;
  const WALK_SPEED = 2.8;
  const RUN_SPEED = 5.2;
  const JUMP_FORCE = -13;
  const LONG_JUMP_FORCE = -15;
  const FRICTION = 0.82;

  // ── State ──────────────────────────────────────────────
  let canvas, ctx;
  let W, H, SCALE;
  let gameState = 'menu'; // menu | playing | paused | dead | win
  let score = 0, coins = 0, lives = 3, timeLeft = 400;
  let worldNum = 1, levelNum = 1;
  let timerInterval = null;
  let animFrame = null;
  let settings = { sound: true, music: true, volume: 70, mobileControls: true, particles: true };
  let highScores = JSON.parse(localStorage.getItem('marioScores') || '[]');

  // ── Input ──────────────────────────────────────────────
  const keys = {};
  const mobileKeys = {};

  // ── Camera ─────────────────────────────────────────────
  const cam = { x: 0, y: 0 };

  // ── Entities ───────────────────────────────────────────
  let player, platforms, coins_list, enemies, particles, powerups, flagpole;
  let levelWidth = 0;

  // ── Player ─────────────────────────────────────────────
  function createPlayer(x, y) {
    return {
      x, y, w: 28, h: 32,
      vx: 0, vy: 0,
      onGround: false,
      big: false,
      star: false, starTimer: 0,
      dead: false, deadTimer: 0,
      facing: 1,
      running: false,
      jumpHeld: false,
      jumpLock: false,
      frame: 0, frameTimer: 0,
      invincible: 0
    };
  }

  // ── Level Generation ────────────────────────────────────
  function buildLevel(w, l) {
    levelWidth = 6400;
    platforms = [];
    coins_list = [];
    enemies = [];
    particles = [];
    powerups = [];

    const groundY = H - TILE * 2;

    // Ground
    for (let x = 0; x < levelWidth; x += TILE) {
      // Gaps
      const gapStart = [1600, 2400, 3200, 4200];
      const inGap = gapStart.some(g => x >= g && x < g + TILE * 3);
      if (!inGap) {
        platforms.push({ x, y: groundY, w: TILE, h: TILE * 2, type: 'ground' });
      }
    }

    // Platforms and bricks
    const layout = [
      { x: 256, y: groundY - TILE * 4, w: TILE * 3, type: 'brick' },
      { x: 384, y: groundY - TILE * 4, w: TILE, type: 'question', item: 'coin' },
      { x: 448, y: groundY - TILE * 4, w: TILE * 3, type: 'brick' },
      { x: 512, y: groundY - TILE * 4, w: TILE, type: 'question', item: 'mushroom' },
      { x: 576, y: groundY - TILE * 4, w: TILE * 3, type: 'brick' },
      { x: 768, y: groundY - TILE * 6, w: TILE, type: 'question', item: 'coin' },
      { x: 800, y: groundY - TILE * 6, w: TILE, type: 'question', item: 'coin' },
      { x: 832, y: groundY - TILE * 6, w: TILE, type: 'question', item: 'coin' },
      { x: 1024, y: groundY - TILE * 5, w: TILE * 4, type: 'platform' },
      { x: 1200, y: groundY - TILE * 7, w: TILE * 4, type: 'platform' },
      { x: 1400, y: groundY - TILE * 5, w: TILE * 3, type: 'brick' },
      { x: 1500, y: groundY - TILE * 5, w: TILE, type: 'question', item: 'star' },
      { x: 1800, y: groundY - TILE * 5, w: TILE * 5, type: 'platform' },
      { x: 2000, y: groundY - TILE * 8, w: TILE * 3, type: 'brick' },
      { x: 2100, y: groundY - TILE * 8, w: TILE, type: 'question', item: 'mushroom' },
      { x: 2600, y: groundY - TILE * 5, w: TILE * 5, type: 'platform' },
      { x: 2800, y: groundY - TILE * 8, w: TILE * 2, type: 'brick' },
      { x: 3000, y: groundY - TILE * 5, w: TILE * 3, type: 'platform' },
      { x: 3400, y: groundY - TILE * 5, w: TILE * 4, type: 'brick' },
      { x: 3600, y: groundY - TILE * 4, w: TILE * 2, type: 'question', item: 'coin' },
      { x: 3800, y: groundY - TILE * 6, w: TILE * 4, type: 'platform' },
      { x: 4400, y: groundY - TILE * 5, w: TILE * 5, type: 'platform' },
      { x: 4700, y: groundY - TILE * 7, w: TILE * 3, type: 'brick' },
      { x: 4900, y: groundY - TILE * 5, w: TILE * 4, type: 'platform' },
      { x: 5200, y: groundY - TILE * 5, w: TILE * 3, type: 'brick' },
      { x: 5400, y: groundY - TILE * 8, w: TILE, type: 'question', item: 'mushroom' },
      { x: 5700, y: groundY - TILE * 5, w: TILE * 4, type: 'platform' },
    ];

    layout.forEach(p => {
      const count = Math.floor(p.w / TILE);
      for (let i = 0; i < count; i++) {
        platforms.push({
          x: p.x + i * TILE, y: p.y, w: TILE, h: TILE,
          type: p.type,
          item: (i === 0 && p.item) ? p.item : null,
          hit: false
        });
      }
    });

    // Coins
    const coinSpots = [
      300, 320, 340, 700, 720, 740, 900, 920,
      1100, 1120, 1140, 1350, 1370, 1900, 1920, 1940,
      2200, 2220, 2700, 2720, 3100, 3120, 3500, 3520,
      4000, 4020, 4500, 4520, 5000, 5020, 5500, 5520
    ];
    coinSpots.forEach(cx => {
      coins_list.push({ x: cx, y: groundY - TILE * 3, w: 16, h: 16, collected: false, anim: 0 });
    });

    // Enemies
    const enemySpots = [
      400, 700, 900, 1100, 1300, 1700, 1900, 2100,
      2500, 2700, 2900, 3300, 3500, 3900, 4300, 4600, 4900, 5300, 5600
    ];
    enemySpots.forEach((ex, i) => {
      enemies.push({
        x: ex, y: groundY - TILE,
        w: 28, h: 28,
        vx: (i % 2 === 0 ? -1 : 1) * 1.2,
        vy: 0,
        onGround: false,
        dead: false, deadTimer: 0,
        type: i % 5 === 4 ? 'koopa' : 'goomba',
        frame: 0, frameTimer: 0
      });
    });

    // Flagpole
    flagpole = { x: levelWidth - TILE * 4, y: groundY - TILE * 10, w: TILE / 4, h: TILE * 10, reached: false };
  }

  // ── AABB collision ─────────────────────────────────────
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ── Physics / Entity Update ────────────────────────────
  function updatePlayer(dt) {
    if (!player || player.dead) {
      if (player && player.dead) {
        player.deadTimer--;
        player.vy += GRAVITY;
        player.y += player.vy;
        if (player.deadTimer <= 0) triggerGameOver();
      }
      return;
    }

    const left = keys['ArrowLeft'] || keys['KeyA'] || mobileKeys['left'];
    const right = keys['ArrowRight'] || keys['KeyD'] || mobileKeys['right'];
    const run = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyX'] || mobileKeys['run'];
    const jump = keys['ArrowUp'] || keys['KeyW'] || keys['KeyZ'] || keys['Space'] || mobileKeys['jump'];

    player.running = run;
    const spd = run ? RUN_SPEED : WALK_SPEED;

    if (left) { player.vx -= 0.9; player.facing = -1; }
    if (right) { player.vx += 0.9; player.facing = 1; }
    if (!left && !right) player.vx *= FRICTION;
    player.vx = Math.max(-spd, Math.min(spd, player.vx));

    if (jump && player.onGround && !player.jumpLock) {
      player.vy = run ? LONG_JUMP_FORCE : JUMP_FORCE;
      player.onGround = false;
      player.jumpLock = true;
      Audio.playJump();
    }
    if (!jump) player.jumpLock = false;

    player.vy += GRAVITY;
    player.vy = Math.min(player.vy, MAX_FALL);
    player.x += player.vx;
    player.y += player.vy;

    // Star
    if (player.star) {
      player.starTimer--;
      if (player.starTimer <= 0) player.star = false;
    }
    if (player.invincible > 0) player.invincible--;

    // Bounds
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > levelWidth) { player.x = levelWidth - player.w; player.vx = 0; }

    // Fell off
    if (player.y > H + 100) killPlayer();

    // Platform collisions
    player.onGround = false;
    platforms.forEach(p => {
      if (!overlap(player, p)) return;

      const overlapX = Math.min(player.x + player.w, p.x + p.w) - Math.max(player.x, p.x);
      const overlapY = Math.min(player.y + player.h, p.y + p.h) - Math.max(player.y, p.y);

      if (overlapX < overlapY) {
        // Horizontal
        if (player.x < p.x) player.x = p.x - player.w;
        else player.x = p.x + p.w;
        player.vx = 0;
      } else {
        // Vertical
        if (player.vy > 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 0;
          hitBlock(p);
        }
      }
    });

    // Animation
    player.frameTimer++;
    if (player.frameTimer > 8) { player.frame = (player.frame + 1) % 4; player.frameTimer = 0; }

    // Coin collection
    coins_list.forEach(c => {
      if (!c.collected && overlap(player, c)) {
        c.collected = true;
        coins++;
        score += 200;
        Audio.playCoin();
        spawnParticles(c.x, c.y, '#ffd700', 6);
        updateHUD();
        if (coins >= 100) { coins -= 100; lives++; updateHUD(); }
      }
    });

    // Enemy collision
    enemies.forEach(e => {
      if (e.dead || !overlap(player, e)) return;
      if (player.star) {
        killEnemy(e, true);
        return;
      }
      // Stomp?
      const stompZone = player.vy > 0 && player.y + player.h < e.y + e.h - 8;
      if (stompZone) {
        killEnemy(e, false);
        player.vy = -8;
        score += 100;
        Audio.playStomp();
        updateHUD();
      } else {
        if (player.invincible <= 0) {
          if (player.big) {
            player.big = false;
            player.h = 32;
            player.invincible = 90;
          } else {
            killPlayer();
          }
        }
      }
    });

    // Powerup collision
    powerups.forEach(pu => {
      if (pu.collected || !overlap(player, pu)) return;
      pu.collected = true;
      if (pu.type === 'mushroom') {
        player.big = true;
        player.h = 48;
        score += 1000;
        Audio.playPowerup();
        showPopup('🍄 SUPER MARIO!');
      } else if (pu.type === 'star') {
        player.star = true;
        player.starTimer = 600;
        score += 1000;
        Audio.playPowerup();
        showPopup('⭐ STAR POWER!');
      }
      updateHUD();
    });

    // Flagpole
    if (!flagpole.reached && player.x + player.w > flagpole.x && player.x < flagpole.x + flagpole.w) {
      flagpole.reached = true;
      Audio.playFlagpole();
      const timeBonus = timeLeft * 50;
      score += timeBonus;
      clearInterval(timerInterval);
      updateHUD();
      setTimeout(() => triggerWin(timeBonus), 1200);
    }
  }

  function hitBlock(p) {
    if (p.type === 'brick') {
      if (player.big) {
        // Smash
        p.smashed = true;
        score += 50;
        Audio.playBrick();
        spawnParticles(p.x + TILE / 2, p.y, '#c84c0c', 8);
        platforms.splice(platforms.indexOf(p), 1);
      } else {
        // Bump
        bumpBlock(p);
        Audio.playBrick();
      }
    } else if (p.type === 'question' && !p.hit) {
      p.hit = true;
      p.type = 'used';
      bumpBlock(p);
      if (p.item === 'coin') {
        coins++;
        score += 200;
        Audio.playCoin();
        spawnParticles(p.x + TILE / 2, p.y, '#ffd700', 5);
        updateHUD();
      } else if (p.item === 'mushroom') {
        powerups.push({ x: p.x, y: p.y - TILE, w: 28, h: 28, type: 'mushroom', vy: 0, vx: 1.5, collected: false });
      } else if (p.item === 'star') {
        powerups.push({ x: p.x, y: p.y - TILE, w: 28, h: 28, type: 'star', vy: -6, vx: 2, collected: false });
      }
    }
  }

  function bumpBlock(p) {
    p.bumpTimer = 12;
    p.bumpOrig = p.y;
  }

  function killEnemy(e, star) {
    e.dead = true;
    e.deadTimer = star ? 20 : 40;
    score += star ? 500 : 100;
    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#e52521', 6);
    updateHUD();
  }

  function killPlayer() {
    if (player.invincible > 0 || player.dead) return;
    player.dead = true;
    player.deadTimer = 80;
    player.vy = -14;
    lives--;
    clearInterval(timerInterval);
    Audio.playDie();
    updateHUD();
  }

  function triggerGameOver() {
    gameState = 'gameover';
    Audio.stopMusic();
    document.getElementById('go-score').textContent = 'SCORE: ' + String(score).padStart(6, '0');
    document.getElementById('go-coins').textContent = 'COINS: ' + String(coins).padStart(2, '0');
    showScreen('gameover-screen');
    saveScore();
  }

  function triggerWin(timeBonus) {
    gameState = 'win';
    Audio.stopMusic();
    document.getElementById('win-score').textContent = 'FINAL SCORE: ' + String(score).padStart(6, '0');
    document.getElementById('win-coins').textContent = 'COINS: ' + String(coins).padStart(2, '0');
    document.getElementById('win-time').textContent = 'TIME BONUS: ' + timeBonus;
    showScreen('victory-screen');
    saveScore();
  }

  function updateEnemies() {
    enemies.forEach(e => {
      if (e.dead) {
        e.deadTimer--;
        return;
      }
      e.vy += GRAVITY;
      e.vy = Math.min(e.vy, MAX_FALL);
      e.x += e.vx;
      e.y += e.vy;

      e.onGround = false;
      platforms.forEach(p => {
        if (!overlap(e, p)) return;
        const ox = Math.min(e.x + e.w, p.x + p.w) - Math.max(e.x, p.x);
        const oy = Math.min(e.y + e.h, p.y + p.h) - Math.max(e.y, p.y);
        if (ox < oy) {
          e.vx *= -1;
          e.x += ox * (e.x < p.x ? -1 : 1);
        } else {
          if (e.vy >= 0) { e.y = p.y - e.h; e.vy = 0; e.onGround = true; }
          else { e.y = p.y + p.h; e.vy = 0; }
        }
      });

      if (e.x < 0 || e.x > levelWidth) e.vx *= -1;
      if (e.y > H + 100) e.dead = true;

      e.frameTimer++;
      if (e.frameTimer > 15) { e.frame = (e.frame + 1) % 2; e.frameTimer = 0; }
    });
  }

  function updatePowerups() {
    powerups.forEach(pu => {
      if (pu.collected) return;
      pu.vy += GRAVITY * 0.5;
      pu.x += pu.vx;
      pu.y += pu.vy;

      platforms.forEach(p => {
        if (!overlap(pu, p)) return;
        const oy = Math.min(pu.y + pu.h, p.y + p.h) - Math.max(pu.y, p.y);
        const ox = Math.min(pu.x + pu.w, p.x + p.w) - Math.max(pu.x, p.x);
        if (ox < oy) { pu.vx *= -1; }
        else if (pu.vy >= 0) { pu.y = p.y - pu.h; pu.vy = 0; }
      });

      if (pu.x < 0 || pu.x > levelWidth) pu.vx *= -1;
    });
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
      p.alpha = p.life / p.maxLife;
    });
  }

  function updateBlocks() {
    platforms.forEach(p => {
      if (p.bumpTimer > 0) {
        p.bumpTimer--;
        p.y = p.bumpOrig - Math.sin((p.bumpTimer / 12) * Math.PI) * 6;
        if (p.bumpTimer === 0) p.y = p.bumpOrig;
      }
    });
  }

  function spawnParticles(x, y, color, count) {
    if (!settings.particles) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const spd = 2 + Math.random() * 3;
      particles.push({
        x, y, color,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        alpha: 1,
        r: 3 + Math.random() * 3
      });
    }
  }

  // ── Camera ─────────────────────────────────────────────
  function updateCamera() {
    if (!player) return;
    const target = player.x - W / 2 + player.w / 2;
    cam.x += (target - cam.x) * 0.12;
    cam.x = Math.max(0, Math.min(cam.x, levelWidth - W));
  }

  // ── Drawing ────────────────────────────────────────────
  function drawBg() {
    // Sky
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, W, H);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[200, 60], [500, 40], [900, 70], [1300, 50], [1700, 65]].forEach(([cx, cy]) => {
      const rx = ((cx - cam.x * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
      drawCloud(rx, cy);
    });

    // Hills
    ctx.fillStyle = '#4caf50';
    [[100, H - TILE * 2], [400, H - TILE * 2], [800, H - TILE * 2]].forEach(([hx, hy]) => {
      const rx = ((hx - cam.x * 0.5) % (W + 300) + W + 300) % (W + 300) - 150;
      ctx.beginPath();
      ctx.arc(rx, hy, 70, Math.PI, 0);
      ctx.fill();
    });
  }

  function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 28, y - 10, 28, 0, Math.PI * 2);
    ctx.arc(x + 58, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlatforms() {
    platforms.forEach(p => {
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx > W + TILE || sx < -TILE) return;

      if (p.type === 'ground') {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(sx, sy, p.w, 6);
        ctx.fillStyle = '#c07022';
        ctx.fillRect(sx, sy + 6, p.w, p.h - 6);
        // Grid lines
        ctx.strokeStyle = '#a05810';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy + 6, p.w, p.h - 6);
      } else if (p.type === 'brick') {
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.strokeStyle = '#8b2000';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, p.w - 4, p.h - 4);
        ctx.strokeRect(sx, sy + p.h / 2, p.w, 0);
        ctx.strokeRect(sx + p.w / 2, sy, 0, p.h / 2);
      } else if (p.type === 'question') {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.fillStyle = '#ff8c00';
        ctx.font = `bold ${TILE - 8}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('?', sx + p.w / 2, sy + p.h - 6);
        ctx.strokeStyle = '#c8a000';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, p.w - 4, p.h - 4);
      } else if (p.type === 'used') {
        ctx.fillStyle = '#888';
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, p.w - 4, p.h - 4);
      } else {
        // generic platform
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(sx, sy, p.w, 6);
      }
    });
  }

  function drawCoins() {
    coins_list.forEach(c => {
      if (c.collected) return;
      const sx = c.x - cam.x, sy = c.y - cam.y;
      if (sx < -TILE || sx > W + TILE) return;
      c.anim = (c.anim + 0.12) % (Math.PI * 2);
      const scaleX = Math.abs(Math.cos(c.anim));
      ctx.save();
      ctx.translate(sx + c.w / 2, sy + c.h / 2);
      ctx.scale(scaleX, 1);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, c.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffec6e';
      ctx.beginPath();
      ctx.arc(-2, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawEnemies() {
    enemies.forEach(e => {
      if (e.dead && e.deadTimer <= 0) return;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -TILE || sx > W + TILE) return;

      if (e.dead) {
        // Flat goomba
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy + e.h - 10, e.w, 10);
        return;
      }

      if (e.type === 'goomba') {
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(sx + e.w / 2, sy + e.h / 2 + 4, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a2d0c';
        // Eyes
        ctx.beginPath();
        ctx.arc(sx + 8, sy + 10, 4, 0, Math.PI * 2);
        ctx.arc(sx + e.w - 8, sy + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        // Feet
        const footOff = e.frame === 0 ? 2 : -2;
        ctx.fillStyle = '#3a1a00';
        ctx.fillRect(sx + 2, sy + e.h - 8 + footOff, 10, 8);
        ctx.fillRect(sx + e.w - 12, sy + e.h - 8 - footOff, 10, 8);
      } else {
        // Koopa
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(sx + 4, sy + 4, e.w - 8, e.h - 4);
        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        ctx.arc(sx + e.w / 2, sy + 8, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(sx + (e.vx < 0 ? 6 : e.w - 10), sy + 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawPowerups() {
    powerups.forEach(pu => {
      if (pu.collected) return;
      const sx = pu.x - cam.x, sy = pu.y - cam.y;
      if (sx < -TILE || sx > W + TILE) return;
      if (pu.type === 'mushroom') {
        ctx.fillStyle = '#e52521';
        ctx.beginPath();
        ctx.arc(sx + pu.w / 2, sy + pu.h / 2, pu.w / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(sx + 2, sy + pu.h / 2, pu.w - 4, pu.h / 2);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(sx + 8, sy + pu.h / 2 - 4, 5, 0, Math.PI * 2);
        ctx.arc(sx + pu.w - 8, sy + pu.h / 2 - 4, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Star
        const t = Date.now() / 200;
        ctx.fillStyle = `hsl(${t * 60 % 360},100%,55%)`;
        drawStar(ctx, sx + pu.w / 2, sy + pu.h / 2, 5, 12, 6);
      }
    });
  }

  function drawStar(c, cx, cy, spikes, outerR, innerR) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    c.beginPath();
    c.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      c.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      c.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    c.closePath();
    c.fill();
  }

  function drawPlayer() {
    if (!player) return;
    const sx = player.x - cam.x, sy = player.y - cam.y;

    ctx.save();
    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    if (player.star) {
      ctx.globalAlpha = 0.85;
    }

    ctx.translate(sx + player.w / 2, sy + player.h / 2);
    if (player.facing === -1) ctx.scale(-1, 1);

    const ph = player.h, pw = player.w;
    const hx = -pw / 2, hy = -ph / 2;

    // Hat
    ctx.fillStyle = '#e52521';
    ctx.fillRect(hx - 2, hy, pw + 4, ph * 0.28);
    ctx.fillRect(hx + 4, hy - 8, pw - 6, 10);

    // Face
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(hx + 2, hy + ph * 0.28, pw - 4, ph * 0.28);

    // Eyes
    ctx.fillStyle = '#333';
    ctx.fillRect(hx + pw - 10, hy + ph * 0.3 + 2, 5, 5);

    // Mustache
    ctx.fillStyle = '#5a2d0c';
    ctx.fillRect(hx + pw / 2 - 2, hy + ph * 0.42, pw / 2, 4);

    // Body
    ctx.fillStyle = '#2244cc';
    ctx.fillRect(hx + 2, hy + ph * 0.56, pw - 4, ph * 0.28);

    // Overall straps
    ctx.fillStyle = '#e52521';
    ctx.fillRect(hx + pw / 2 - 6, hy + ph * 0.44, 10, ph * 0.14);

    // Legs
    const legOff = player.onGround ? (player.frame % 2 === 0 ? 3 : -3) : 0;
    ctx.fillStyle = '#5a2d0c';
    ctx.fillRect(hx + 2, hy + ph * 0.84, pw / 2 - 3, ph * 0.16 + legOff);
    ctx.fillRect(hx + pw / 2 + 1, hy + ph * 0.84, pw / 2 - 3, ph * 0.16 - legOff);

    ctx.restore();
  }

  function drawFlagpole() {
    if (!flagpole) return;
    const sx = flagpole.x - cam.x;
    if (sx < -TILE || sx > W + TILE) return;

    ctx.fillStyle = '#ccc';
    ctx.fillRect(sx, flagpole.y, flagpole.w, flagpole.h);

    ctx.fillStyle = '#e52521';
    const flagY = flagpole.reached ? flagpole.y + flagpole.h - 30 : flagpole.y;
    ctx.fillRect(sx, flagY, 30, 20);

    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(sx + flagpole.w / 2, flagpole.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── HUD ────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hud-score').textContent = String(score).padStart(6, '0');
    document.getElementById('hud-coins').textContent = '🪙 ' + String(coins).padStart(2, '0');
    document.getElementById('hud-world').textContent = worldNum + '-' + levelNum;
    document.getElementById('hud-time').textContent = Math.max(0, timeLeft);
    const hearts = '❤️'.repeat(Math.max(0, lives));
    document.getElementById('hud-lives').innerHTML = hearts || '💀';
  }

  function showPopup(msg) {
    const el = document.getElementById('powerup-popup');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function showBanner(msg) {
    const el = document.getElementById('level-banner');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  // ── Screen management ──────────────────────────────────
  function showScreen(id) {
    ['start-screen', 'pause-screen', 'gameover-screen', 'victory-screen', 'settings-screen', 'scores-screen']
      .forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
      });
  }

  function hideAllScreens() {
    ['start-screen', 'pause-screen', 'gameover-screen', 'victory-screen', 'settings-screen', 'scores-screen']
      .forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
      });
  }

  // ── Timer ──────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (gameState !== 'playing') return;
      timeLeft = Math.max(0, timeLeft - 1);
      updateHUD();
      if (timeLeft <= 0) killPlayer();
    }, 1000);
  }

  // ── Main Loop ──────────────────────────────────────────
  function loop() {
    animFrame = requestAnimationFrame(loop);
    if (gameState !== 'playing') return;

    ctx.clearRect(0, 0, W, H);
    drawBg();
    updateCamera();

    ctx.save();
    drawFlagpole();
    drawPlatforms();
    drawCoins();
    drawPowerups();
    drawEnemies();
    drawPlayer();
    drawParticles();
    ctx.restore();

    updatePlayer();
    updateEnemies();
    updatePowerups();
    updateParticles();
    updateBlocks();
  }

  // ── Resize ─────────────────────────────────────────────
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── High Scores ────────────────────────────────────────
  function saveScore() {
    highScores.push({ score, coins, world: worldNum + '-' + levelNum, ts: Date.now() });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
    localStorage.setItem('marioScores', JSON.stringify(highScores));
    // Try API
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PLAYER', score, world: worldNum + '-' + levelNum })
    }).catch(() => {});
  }

  // ── PUBLIC API ─────────────────────────────────────────
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') pause();
        else if (gameState === 'paused') resume();
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    // Mobile detection
    if ('ontouchstart' in window) {
      document.getElementById('mobile-controls').style.display = 'flex';
    }

    loadSettings();
    Audio.init();
    updateHUD();
  }

  function startGame() {
    score = 0; coins = 0; lives = 3; timeLeft = 400;
    worldNum = 1; levelNum = 1;
    hideAllScreens();
    loadLevel();
  }

  function loadLevel() {
    timeLeft = 400;
    cam.x = 0; cam.y = 0;
    resize();
    buildLevel(worldNum, levelNum);
    player = createPlayer(TILE * 3, H - TILE * 4);
    gameState = 'playing';
    document.getElementById('hud').style.display = 'flex';
    showBanner('WORLD ' + worldNum + '-' + levelNum);
    startTimer();
    Audio.startMusic();
    updateHUD();
    if (!animFrame) loop();
  }

  function pause() {
    gameState = 'paused';
    showScreen('pause-screen');
  }

  function resume() {
    gameState = 'playing';
    hideAllScreens();
  }

  function restartLevel() {
    hideAllScreens();
    lives = Math.max(1, lives);
    loadLevel();
  }

  function nextLevel() {
    levelNum++;
    if (levelNum > 4) { levelNum = 1; worldNum++; }
    hideAllScreens();
    loadLevel();
  }

  function goToMenu() {
    gameState = 'menu';
    clearInterval(timerInterval);
    Audio.stopMusic();
    cancelAnimationFrame(animFrame);
    animFrame = null;
    document.getElementById('hud').style.display = 'none';
    showScreen('start-screen');
  }

  function showHighScores() {
    const list = document.getElementById('scores-list');
    list.innerHTML = '';
    if (highScores.length === 0) {
      list.innerHTML = '<p style="opacity:0.5;font-size:10px">NO SCORES YET</p>';
    } else {
      highScores.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `<span>#${i+1} ${s.world || '1-1'}</span><span>${String(s.score).padStart(6,'0')}</span>`;
        list.appendChild(row);
      });
    }
    showScreen('scores-screen');
  }

  function showSettings() {
    showScreen('settings-screen');
  }

  function closeSettings() {
    if (gameState === 'playing') hideAllScreens();
    else if (gameState === 'paused') showScreen('pause-screen');
    else showScreen('start-screen');
  }

  function toggleSound() {
    settings.sound = Audio.toggleSound();
    document.getElementById('toggle-sound').classList.toggle('on', settings.sound);
    saveSettings();
  }

  function toggleMusic() {
    settings.music = Audio.toggleMusic();
    document.getElementById('toggle-music').classList.toggle('on', settings.music);
    saveSettings();
  }

  function setVolume(v) {
    settings.volume = v;
    Audio.setVolume(v);
    saveSettings();
  }

  function toggleMobileControls() {
    settings.mobileControls = !settings.mobileControls;
    document.getElementById('toggle-mobile').classList.toggle('on', settings.mobileControls);
    document.getElementById('mobile-controls').style.display = settings.mobileControls ? 'flex' : 'none';
    saveSettings();
  }

  function toggleParticles() {
    settings.particles = !settings.particles;
    document.getElementById('toggle-particles').classList.toggle('on', settings.particles);
    saveSettings();
  }

  function mobilePress(key) {
    mobileKeys[key] = true;
    Audio.resume();
  }

  function mobileRelease(key) {
    mobileKeys[key] = false;
  }

  function saveSettings() {
    localStorage.setItem('marioSettings', JSON.stringify(settings));
  }

  function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('marioSettings') || 'null');
    if (saved) {
      settings = { ...settings, ...saved };
      Audio.setVolume(settings.volume);
      document.getElementById('volume-slider').value = settings.volume;
      document.getElementById('toggle-sound').classList.toggle('on', settings.sound);
      document.getElementById('toggle-music').classList.toggle('on', settings.music);
      document.getElementById('toggle-mobile').classList.toggle('on', settings.mobileControls);
      document.getElementById('toggle-particles').classList.toggle('on', settings.particles);
    }
  }

  // ── Bootstrap ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    init();
    showScreen('start-screen');
    document.getElementById('hud').style.display = 'none';
  });

  // Fix the gameover screen button that had window.startGame()
  window.startGame = () => startGame();

  return {
    startGame, pause, resume, restartLevel, nextLevel, goToMenu,
    showHighScores, showSettings, closeSettings,
    toggleSound, toggleMusic, setVolume,
    toggleMobileControls, toggleParticles,
    mobilePress, mobileRelease
  };
})();
function resizeCanvas() {
  const canvas = document.getElementById("canvas");

  const aspectRatio = 9 / 16; // portrait

  let w = window.innerWidth;
  let h = window.innerHeight;

  if (h > w / aspectRatio) {
    h = w / aspectRatio;
  } else {
    w = h * aspectRatio;
  }

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", resizeCanvas);