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
let homeTimeouts = 3;
let awayTimeouts = 3;
let selectedDown = 1;

// Marquee state
let marqueeText = '';
let marqueeOffset = 0;      // current scroll position in dot columns
let marqueeRepeatsLeft = 0;  // how many passes remain
let marqueeActive = false;
let marqueeTextWidth = 0;    // total width in dot columns
let lastMarqueeTime = 0;
const MARQUEE_SPEED = 30;    // dots per second

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
const BOARD_ROWS = 55;

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

// Draw a character scaled up (each LED dot becomes scale x scale dots)
function drawCharScaled(char, startCol, startRow, scale, color, brightColor, dimColor) {
  const glyph = LED_FONT[char.toUpperCase()] || LED_FONT[' '];
  for (let row = 0; row < CHAR_H; row++) {
    for (let col = 0; col < CHAR_W; col++) {
      const on = (glyph[row] >> (CHAR_W - 1 - col)) & 1;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          drawDot(startCol + col * scale + sx, startRow + row * scale + sy, on, color, brightColor, dimColor);
        }
      }
    }
  }
}

function drawStringScaledCenter(str, centerCol, startRow, scale, color, brightColor, dimColor) {
  const charW = CHAR_W * scale;
  const gap = CHAR_GAP * scale;
  const totalW = str.length * (charW + gap) - gap;
  let col = Math.round(centerCol - totalW / 2);
  for (let i = 0; i < str.length; i++) {
    drawCharScaled(str[i], col, startRow, scale, color, brightColor, dimColor);
    col += charW + gap;
  }
}

function drawTimeoutDots(centerCol, row, remaining) {
  const gap = 4;
  const startCol = centerCol - gap;
  for (let i = 0; i < 3; i++) {
    drawPossessionDot(startCol + i * gap, row, i < remaining);
  }
}

// Draw a string clipped to a column range (for marquee)
function drawStringClipped(str, startCol, startRow, clipLeft, clipRight, color, brightColor, dimColor) {
  let col = startCol;
  for (let i = 0; i < str.length; i++) {
    const charEnd = col + CHAR_W;
    // Skip chars entirely outside clip region
    if (charEnd > clipLeft && col < clipRight) {
      const glyph = LED_FONT[str[i].toUpperCase()] || LED_FONT[' '];
      for (let row = 0; row < CHAR_H; row++) {
        for (let c = 0; c < CHAR_W; c++) {
          const dotCol = col + c;
          if (dotCol >= clipLeft && dotCol < clipRight) {
            const on = (glyph[row] >> (CHAR_W - 1 - c)) & 1;
            drawDot(dotCol, startRow + row, on, color, brightColor, dimColor);
          }
        }
      }
    }
    col += CHAR_W + CHAR_GAP;
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

  // Vertical dividers (top section only)
  for (let r = 1; r < 34; r++) {
    drawDot(40, r, false, null, null, '#150404');
    drawDot(80, r, false, null, null, '#150404');
  }

  // Horizontal divider separating top and bottom strip
  for (let c = 1; c < BOARD_COLS - 1; c++) {
    drawDot(c, 35, false, null, null, '#150404');
  }

  // HOME (left: centered at col 20)
  drawStringCenter(homeName.substring(0, 6), 20, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringScaledCenter(formatScore(homeScore), 20, 12, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawPossessionDot(20, 28, possession === 'home');

  // AWAY (right: centered at col 100)
  drawStringCenter(awayName.substring(0, 6), 100, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringScaledCenter(formatScore(awayScore), 100, 12, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawPossessionDot(100, 28, possession === 'away');

  // CENTER — QTR + Clock + Play Clock (all fit within cols 41-79)
  drawStringCenter('QTR', 53, 2, '#cc1111', '#ee3333', '#120303');
  drawStringCenter(currentQuarter.toString(), 53, 11, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
  drawStringCenter(formatClock(gameClockSeconds), 60, 21, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  drawStringCenter('PC', 67, 2, '#cc1111', '#ee3333', '#120303');
  drawStringCenter(playClockSeconds.toString().padStart(2, '0'), 67, 11, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);

  // BOTTOM STRIP
  // Timeouts left
  drawTimeoutDots(20, 38, homeTimeouts);
  // Down & Distance center
  drawStringCenter(currentDown, 60, 37, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
  // Timeouts right
  drawTimeoutDots(100, 38, awayTimeouts);

  // Horizontal divider above marquee
  for (let c = 1; c < BOARD_COLS - 1; c++) {
    drawDot(c, 45, false, null, null, '#150404');
  }

  // MARQUEE ROW (rows 47-53)
  const MARQUEE_ROW = 47;
  const MARQUEE_LEFT = 2;
  const MARQUEE_RIGHT = BOARD_COLS - 2;

  if (marqueeActive && marqueeText.length > 0) {
    // Advance scroll based on time
    const now = performance.now();
    if (lastMarqueeTime > 0) {
      const dt = (now - lastMarqueeTime) / 1000;
      marqueeOffset -= dt * MARQUEE_SPEED;

      // Text has fully scrolled off the left
      if (marqueeOffset < -marqueeTextWidth) {
        marqueeRepeatsLeft--;
        if (marqueeRepeatsLeft <= 0) {
          marqueeActive = false;
          updateMarqueeStatus();
        } else {
          marqueeOffset = MARQUEE_RIGHT;
          updateMarqueeStatus();
        }
      }
    }
    lastMarqueeTime = now;

    drawStringClipped(
      marqueeText,
      Math.round(marqueeOffset), MARQUEE_ROW,
      MARQUEE_LEFT, MARQUEE_RIGHT,
      COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM
    );
  }

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

function setDown(n) {
  selectedDown = n;
  const dist = document.getElementById('ctrl-distance').value;
  currentDown = ordinal(n) + ' & ' + dist;
}

function applyDistance() {
  const dist = document.getElementById('ctrl-distance').value;
  currentDown = ordinal(selectedDown) + ' & ' + dist;
}

function setGoal() {
  currentDown = ordinal(selectedDown) + ' & GOAL';
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

function useTimeout(team) {
  if (team === 'home' && homeTimeouts > 0) homeTimeouts--;
  else if (team === 'away' && awayTimeouts > 0) awayTimeouts--;
}

function resetTimeouts() {
  homeTimeouts = 3;
  awayTimeouts = 3;
}

// ── Marquee ──

function publishMarquee() {
  const text = document.getElementById('ctrl-marquee-text').value.toUpperCase();
  const repeats = parseInt(document.getElementById('ctrl-marquee-repeats').value, 10) || 1;
  if (!text.trim()) return;

  marqueeText = text;
  marqueeTextWidth = text.length * (CHAR_W + CHAR_GAP) - CHAR_GAP;
  marqueeOffset = BOARD_COLS; // start off-screen right
  marqueeRepeatsLeft = repeats;
  marqueeActive = true;
  lastMarqueeTime = 0;
  updateMarqueeStatus();
}

function stopMarquee() {
  marqueeActive = false;
  marqueeRepeatsLeft = 0;
  lastMarqueeTime = 0;
  updateMarqueeStatus();
}

function updateMarqueeStatus() {
  const el = document.getElementById('marquee-status');
  if (marqueeActive) {
    el.textContent = 'Scrolling... (' + marqueeRepeatsLeft + ' left)';
    el.style.color = '#6f6';
  } else {
    el.textContent = 'Idle';
    el.style.color = '#888';
  }
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
  selectedDown = 1;
  document.getElementById('ctrl-distance').value = '10';
  resetGameClock();
  resetPlayClock();
  setPossession(null);
  resetTimeouts();
  stopMarquee();
}
