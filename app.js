// ── State ──

let homeScore = 0;
let awayScore = 0;
let gameClockSeconds = 15 * 60;
let gameClockInterval = null;
let playClockSeconds = 40;
let playClockInterval = null;
let currentQuarter = '1';
let currentDown = '1ST & 10';
let possession = null;
let homeName = 'HOME';
let awayName = 'AWAY';

// ── Canvas Setup ──

const canvas = document.getElementById('led-canvas');
const ctx = canvas.getContext('2d');

// LED dot settings
const CHAR_W = 5;
const CHAR_H = 7;
const CHAR_GAP = 1;

const COLOR_ON = '#ff1a1a';
const COLOR_ON_BRIGHT = '#ff4444';
const COLOR_DIM = '#1a0505';
const COLOR_BG = '#0a0a0a';
const COLOR_AMBER_ON = '#ffaa00';
const COLOR_AMBER_BRIGHT = '#ffcc44';
const COLOR_AMBER_DIM = '#1a1005';

// Board layout in dot units
const BOARD_COLS = 120;
const BOARD_ROWS = 40;

// Computed pixel values
let dotRadius, dotSpacing;

function resizeCanvas() {
  const containerWidth = canvas.parentElement.clientWidth - 12; // frame padding
  dotSpacing = Math.max(2, Math.floor(containerWidth / BOARD_COLS));
  dotRadius = Math.max(0.8, dotSpacing * 0.36);

  canvas.width = BOARD_COLS * dotSpacing;
  canvas.height = BOARD_ROWS * dotSpacing;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── LED Drawing ──

function drawDot(col, row, on, color, brightColor, dimColor) {
  const x = col * dotSpacing + dotSpacing / 2;
  const y = row * dotSpacing + dotSpacing / 2;

  if (on) {
    // Glow
    const glowR = dotRadius * 2.5;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, brightColor || COLOR_ON_BRIGHT);
    glow.addColorStop(0.4, color || COLOR_ON);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = brightColor || COLOR_ON_BRIGHT;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, dotRadius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = dimColor || COLOR_DIM;
    ctx.fill();
  }
}

function drawChar(char, startCol, startRow, color, brightColor, dimColor) {
  const glyph = LED_FONT[char.toUpperCase()] || LED_FONT[' '];
  for (let row = 0; row < CHAR_H; row++) {
    for (let col = 0; col < CHAR_W; col++) {
      const on = (glyph[row] >> (CHAR_W - 1 - col)) & 1;
      drawDot(startCol + col, startRow + row, on, color, brightColor, dimColor);
    }
  }
}

function drawString(str, startCol, startRow, color, brightColor, dimColor) {
  let col = startCol;
  for (let i = 0; i < str.length; i++) {
    drawChar(str[i], col, startRow, color, brightColor, dimColor);
    col += CHAR_W + CHAR_GAP;
  }
}

function drawStringCenter(str, centerCol, startRow, color, brightColor, dimColor) {
  const totalW = str.length * (CHAR_W + CHAR_GAP) - CHAR_GAP;
  const startC = Math.round(centerCol - totalW / 2);
  drawString(str, startC, startRow, color, brightColor, dimColor);
}

function drawPossessionDot(col, row, active) {
  const cx = col * dotSpacing + dotSpacing / 2;
  const cy = row * dotSpacing + dotSpacing / 2;
  const r = dotRadius * 2.5;

  if (active) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
    glow.addColorStop(0, COLOR_ON_BRIGHT);
    glow.addColorStop(0.3, COLOR_ON);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_ON_BRIGHT;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0808';
    ctx.fill();
  }
}

// ── Render ──

function formatScore(n) {
  return n.toString().padStart(2, '0');
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

function render() {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Divider columns
  for (let r = 1; r < BOARD_ROWS - 1; r++) {
    drawDot(40, r, false, null, null, '#150404');
    drawDot(80, r, false, null, null, '#150404');
  }

  // HOME (left: centered at col 20)
  drawStringCenter('HOME', 20, 2, '#cc1111', '#ee3333', '#120303');
  drawStringCenter(homeName.substring(0, 6), 20, 11, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringCenter(formatScore(homeScore), 20, 21, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawPossessionDot(20, 32, possession === 'home');

  // AWAY (right: centered at col 100)
  drawStringCenter('AWAY', 100, 2, '#cc1111', '#ee3333', '#120303');
  drawStringCenter(awayName.substring(0, 6), 100, 11, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringCenter(formatScore(awayScore), 100, 21, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawPossessionDot(100, 32, possession === 'away');

  // CENTER
  drawStringCenter('QTR', 60, 2, '#cc1111', '#ee3333', '#120303');
  drawStringCenter(currentQuarter.toString(), 60, 10, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
  drawStringCenter(formatClock(gameClockSeconds), 60, 19, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringCenter(currentDown, 60, 28, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);

  // Play clock (top-right of center section)
  drawString('PC', 73, 2, '#cc1111', '#ee3333', '#120303');
  drawString(playClockSeconds.toString().padStart(2, '0'), 73, 10, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);

  requestAnimationFrame(render);
}

render();

// ── Game Logic ──

function ordinal(n) {
  const suffixes = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };
  return suffixes[n] || n;
}

function changeScore(team, points) {
  if (team === 'home') {
    homeScore = Math.max(0, homeScore + points);
  } else {
    awayScore = Math.max(0, awayScore + points);
  }
}

function updateTeamNames() {
  homeName = (document.getElementById('ctrl-home-name').value.toUpperCase() || 'HOME').substring(0, 6);
  awayName = (document.getElementById('ctrl-away-name').value.toUpperCase() || 'AWAY').substring(0, 6);
}

function startGameClock() {
  if (gameClockInterval) return;
  gameClockInterval = setInterval(() => {
    if (gameClockSeconds <= 0) {
      stopGameClock();
      return;
    }
    gameClockSeconds--;
  }, 1000);
}

function stopGameClock() {
  clearInterval(gameClockInterval);
  gameClockInterval = null;
}

function resetGameClock() {
  stopGameClock();
  gameClockSeconds = 15 * 60;
}

function setGameClock() {
  stopGameClock();
  const val = document.getElementById('ctrl-clock').value;
  const parts = val.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    gameClockSeconds = m * 60 + s;
  }
}

function setQuarter(q) {
  currentQuarter = q.toString();
  if (q !== 'OT') {
    resetGameClock();
  }
}

function updateDownDistance() {
  const down = document.getElementById('ctrl-down').value;
  const dist = document.getElementById('ctrl-distance').value;
  currentDown = ordinal(parseInt(down, 10)) + ' & ' + dist;
}

function setGoal() {
  const down = document.getElementById('ctrl-down').value;
  currentDown = ordinal(parseInt(down, 10)) + ' & GOAL';
}

function startPlayClock(seconds) {
  stopPlayClock();
  playClockSeconds = seconds;
  playClockInterval = setInterval(() => {
    if (playClockSeconds <= 0) {
      stopPlayClock();
      return;
    }
    playClockSeconds--;
  }, 1000);
}

function stopPlayClock() {
  clearInterval(playClockInterval);
  playClockInterval = null;
}

function resetPlayClock() {
  stopPlayClock();
  playClockSeconds = 40;
}

function setPossession(team) {
  possession = team;
}

function resetGame() {
  homeScore = 0;
  awayScore = 0;
  homeName = 'HOME';
  awayName = 'AWAY';
  document.getElementById('ctrl-home-name').value = 'HOME';
  document.getElementById('ctrl-away-name').value = 'AWAY';
  currentQuarter = '1';
  currentDown = '1ST & 10';
  document.getElementById('ctrl-down').value = '1';
  document.getElementById('ctrl-distance').value = '10';
  resetGameClock();
  resetPlayClock();
  setPossession(null);
}
