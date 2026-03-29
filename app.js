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
var showTimeMgmt = true;

// Marquee state
let marqueeText = '';
let marqueeOffset = 0;
let marqueeRepeatsLeft = 0;
let marqueeActive = false;
let marqueeTextWidth = 0;
let lastMarqueeTime = 0;
const MARQUEE_SPEED = 30;

// Animation state
var animationActive = false;
var animationType = '';  // 'referee' | 'touchdown' | 'trf'
var animationStartTime = 0;

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

const BOARD_COLS = 120;
const BOARD_ROWS = 55;

// Canvas refs (set on init)
let canvas, ctx, dotRadius, dotSpacing;

// ── Helpers ──

function formatScore(n) {
  return n.toString().padStart(2, '0');
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
}

function ordinal(n) {
  const suffixes = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };
  return suffixes[n] || n;
}

// ── LED Drawing ──

function drawDot(col, row, on, color, brightColor, dimColor) {
  const x = col * dotSpacing + dotSpacing / 2;
  const y = row * dotSpacing + dotSpacing / 2;

  if (on) {
    const glowR = dotRadius * 2.5;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, brightColor || COLOR_ON_BRIGHT);
    glow.addColorStop(0.4, color || COLOR_ON);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

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

function drawTimeoutDots(centerCol, row, remaining) {
  const gap = 4;
  const startCol = centerCol - gap;
  for (let i = 0; i < 3; i++) {
    drawPossessionDot(startCol + i * gap, row, i < remaining);
  }
}

// Draw a string with tighter character gap
function drawStringCenterTight(str, centerCol, startRow, color, brightColor, dimColor) {
  var tightGap = 0; // no gap between chars
  var totalW = str.length * (CHAR_W + tightGap) - tightGap;
  var col = Math.round(centerCol - totalW / 2);
  for (var i = 0; i < str.length; i++) {
    drawChar(str[i], col, startRow, color, brightColor, dimColor);
    col += CHAR_W + tightGap;
  }
}

function drawStringClipped(str, startCol, startRow, clipLeft, clipRight, color, brightColor, dimColor) {
  let col = startCol;
  for (let i = 0; i < str.length; i++) {
    const charEnd = col + CHAR_W;
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

function resizeCanvas() {
  var containerWidth = canvas.parentElement.clientWidth - 12;
  var targetWidth = Math.min(containerWidth, 400);
  dotSpacing = targetWidth / BOARD_COLS;
  dotRadius = Math.max(0.6, dotSpacing * 0.36);

  canvas.width = Math.round(BOARD_COLS * dotSpacing);
  canvas.height = Math.round(BOARD_ROWS * dotSpacing);
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}

// Referee pixel art frames — drawn at 2x scale so each pixel = 2x2 LED dots
// Legend: W=white, B=black(stripe), Y=yellow, .=empty
var REFEREE_FRAME_DATA = (function () {
  function parseFrame(lines) {
    var pixels = [];
    for (var r = 0; r < lines.length; r++) {
      for (var c = 0; c < lines[r].length; c++) {
        var ch = lines[r][c];
        if (ch === 'W') pixels.push([c, r, '#ffffff', '#eeeeee']);
        else if (ch === 'B') pixels.push([c, r, '#111111', '#333333']);
        else if (ch === 'Y') pixels.push([c, r, '#ffdd00', '#ffee44']);
        else if (ch === 'S') pixels.push([c, r, '#ffaa88', '#ffccaa']); // skin
      }
    }
    return pixels;
  }

  // Frame 1: arms down
  var f1 = [
    '...SSS...',
    '...SSS...',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    '.SWBWBWS.',
    'S.WBWBW.S',
    '..WBWBW..',
    '...WBW...',
    '...WBW...',
    '...W.W...',
    '...W.W...',
    '..W...W..',
    '..W...W..',
  ];

  // Frame 2: arms out (timeout T-pose)
  var f2 = [
    '...SSS...',
    '...SSS...',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    'SWWBWBWWS',
    'S.WBWBW.S',
    '..WBWBW..',
    '...WBW...',
    '...WBW...',
    '...W.W...',
    '...W.W...',
    '..W...W..',
    '..W...W..',
  ];

  // Frame 3: right arm up with flag
  var f3 = [
    '...SSS.YY',
    '...SSS.YY',
    '..WBWBWS.',
    '..WBWBW..',
    '..WBWBW..',
    '.SWBWBW..',
    'S.WBWBW..',
    '..WBWBW..',
    '...WBW...',
    '...WBW...',
    '...W.W...',
    '...W.W...',
    '..W...W..',
    '..W...W..',
  ];

  // Frame 4: both arms up (touchdown)
  var f4 = [
    'S..SSS..S',
    '.S.SSS.S.',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    '..WBWBW..',
    '...WBW...',
    '...WBW...',
    '...W.W...',
    '...W.W...',
    '..W...W..',
    '..W...W..',
  ];

  return {
    armsDown: parseFrame(f1),
    timeout: parseFrame(f2),
    flag: parseFrame(f3),
    touchdown: parseFrame(f4),
  };
})();

var REFEREE_SEQUENCE = [
  'armsDown', 'timeout', 'armsDown', 'timeout',
  'armsDown', 'flag', 'armsDown',
  'touchdown', 'armsDown', 'touchdown',
];

// ── Referee Animation ──

function renderRefereeAnimation(elapsed) {
  var FRAME_MS = 400;
  var TOTAL_MS = 4000;
  if (elapsed >= TOTAL_MS) { animationActive = false; return; }

  var frameIdx = Math.floor(elapsed / FRAME_MS) % REFEREE_SEQUENCE.length;
  var pixels = REFEREE_FRAME_DATA[REFEREE_SEQUENCE[frameIdx]];

  var scale = 2;
  var originCol = Math.round(60 - (9 * scale) / 2);
  var originRow = 2;

  for (var i = 0; i < pixels.length; i++) {
    var p = pixels[i];
    for (var sy = 0; sy < scale; sy++) {
      for (var sx = 0; sx < scale; sx++) {
        drawDot(originCol + p[0] * scale + sx, originRow + p[1] * scale + sy, true, p[2], p[3], COLOR_DIM);
      }
    }
  }

  drawStringCenter('REFEREE', 60, 32, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
  drawStringCenter('REVIEW', 60, 41, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
}

// ── Touchdown Animation ──

function renderTouchdownAnimation(elapsed) {
  var TOTAL_MS = 4000;
  if (elapsed >= TOTAL_MS) { animationActive = false; return; }

  var flash = Math.floor(elapsed / 200) % 2 === 0;
  var color1 = flash ? COLOR_ON : COLOR_AMBER_ON;
  var bright1 = flash ? COLOR_ON_BRIGHT : COLOR_AMBER_BRIGHT;
  var color2 = flash ? COLOR_AMBER_ON : COLOR_ON;
  var bright2 = flash ? COLOR_AMBER_BRIGHT : COLOR_ON_BRIGHT;

  // Big "TD" at 3x scale centered
  drawStringScaledCenter('TD', 60, 3, 3, color1, bright1, COLOR_DIM);

  // "TOUCHDOWN" normal size below
  drawStringCenter('TOUCHDOWN', 60, 26, color2, bright2, COLOR_DIM);

  // Decorative stars flashing
  var starPhase = Math.floor(elapsed / 150) % 4;
  var starPositions = [[10,5],[110,5],[10,35],[110,35],[25,20],[95,20],[15,28],[105,28]];
  for (var i = 0; i < starPositions.length; i++) {
    if ((i + starPhase) % 3 !== 0) {
      var sp = starPositions[i];
      drawDot(sp[0], sp[1], true, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
      drawDot(sp[0]-1, sp[1], true, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_DIM);
      drawDot(sp[0]+1, sp[1], true, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_DIM);
      drawDot(sp[0], sp[1]-1, true, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_DIM);
      drawDot(sp[0], sp[1]+1, true, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_DIM);
    }
  }

  // Bottom text
  drawStringCenter('6 POINTS', 60, 38, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
}

// ── TRF Animation ──

// Football pixel art (small, for scrolling in)
var FOOTBALL_PIXELS = (function () {
  var art = [
    '....BBB....',
    '..BBBBBBB..',
    '.BBBWBWBBB.',
    'BBBBBBBBBBB',
    '.BBBWBWBBB.',
    '..BBBBBBB..',
    '....BBB....',
  ];
  var pixels = [];
  for (var r = 0; r < art.length; r++) {
    for (var c = 0; c < art[r].length; c++) {
      var ch = art[r][c];
      if (ch === 'B') pixels.push([c, r, '#8B4513', '#A0522D']);
      else if (ch === 'W') pixels.push([c, r, '#ffffff', '#eeeeee']);
    }
  }
  return { pixels: pixels, width: 11, height: 7 };
})();

function renderTRFAnimation(elapsed) {
  var TOTAL_MS = 6000;
  if (elapsed >= TOTAL_MS) { animationActive = false; return; }

  // Football slides right-to-left across the entire board continuously
  var footballProgress = elapsed / TOTAL_MS;
  var footballStart = BOARD_COLS + FOOTBALL_PIXELS.width;
  var footballEnd = -FOOTBALL_PIXELS.width - 10;
  var footballCol = Math.round(footballStart + footballProgress * (footballEnd - footballStart));
  var footballRow = 4;

  for (var i = 0; i < FOOTBALL_PIXELS.pixels.length; i++) {
    var p = FOOTBALL_PIXELS.pixels[i];
    var dc = footballCol + p[0];
    if (dc >= 0 && dc < BOARD_COLS) {
      drawDot(dc, footballRow + p[1], true, p[2], p[3], COLOR_DIM);
    }
  }

  // Text appears line by line
  var showLine1 = elapsed >= 800;
  var showLine2 = elapsed >= 1400;
  var showLine3 = elapsed >= 2000;

  if (showLine1) {
    drawStringCenter('T\u00DCRKIYE', 60, 16, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  }
  if (showLine2) {
    drawStringCenter('RAGBI', 60, 26, '#ffffff', '#ffffff', '#151515');
  }
  if (showLine3) {
    drawStringCenter('FEDERASYONU', 60, 36, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
  }
}

// ── Animation Dispatcher ──

function renderAnimation() {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var elapsed = performance.now() - animationStartTime;

  switch (animationType) {
    case 'referee': renderRefereeAnimation(elapsed); break;
    case 'touchdown': renderTouchdownAnimation(elapsed); break;
    case 'trf': renderTRFAnimation(elapsed); break;
    default: animationActive = false;
  }
}

function playAnimation(type) {
  animationType = type;
  animationActive = true;
  animationStartTime = performance.now();
}

function stopAnimation() {
  animationActive = false;
}

function render() {
  // Animation takeover
  if (animationActive) {
    renderAnimation();
    requestAnimationFrame(render);
    return;
  }

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (showTimeMgmt) {
    // ── FULL LAYOUT (with clocks) ──

    // Vertical dividers
    for (let r = 1; r < 34; r++) {
      drawDot(40, r, false, null, null, '#150404');
      drawDot(80, r, false, null, null, '#150404');
    }

    // Horizontal divider
    for (let c = 1; c < BOARD_COLS - 1; c++) {
      drawDot(c, 35, false, null, null, '#150404');
    }

    // HOME
    drawStringCenter(homeName.substring(0, 6), 20, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawStringScaledCenter(formatScore(homeScore), 20, 12, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawPossessionDot(20, 28, possession === 'home');

    // AWAY
    drawStringCenter(awayName.substring(0, 6), 100, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawStringScaledCenter(formatScore(awayScore), 100, 12, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawPossessionDot(100, 28, possession === 'away');

    // CENTER
    drawStringCenter('Q' + currentQuarter.toString(), 60, 2, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
    drawStringCenter(formatClock(gameClockSeconds), 60, 12, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawStringCenter('PC ' + playClockSeconds.toString().padStart(2, '0'), 60, 22, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);

    // BOTTOM STRIP
    drawTimeoutDots(20, 38, homeTimeouts);
    drawStringCenter(currentDown, 60, 37, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
    drawTimeoutDots(100, 38, awayTimeouts);

  } else {
    // ── EXPANDED LAYOUT (no clocks) ──
    // Same structure as full, just spread vertically in center

    // Vertical dividers
    for (let r = 1; r < 34; r++) {
      drawDot(40, r, false, null, null, '#150404');
      drawDot(80, r, false, null, null, '#150404');
    }

    // Horizontal divider
    for (let c = 1; c < BOARD_COLS - 1; c++) {
      drawDot(c, 35, false, null, null, '#150404');
    }

    // HOME — name + score spaced out more
    drawStringCenter(homeName.substring(0, 6), 20, 4, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawStringScaledCenter(formatScore(homeScore), 20, 14, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawPossessionDot(20, 30, possession === 'home');

    // AWAY
    drawStringCenter(awayName.substring(0, 6), 100, 4, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawStringScaledCenter(formatScore(awayScore), 100, 14, 2, COLOR_ON, COLOR_ON_BRIGHT, COLOR_DIM);
    drawPossessionDot(100, 30, possession === 'away');

    // CENTER — quarter and down spread vertically
    drawStringCenter('Q' + currentQuarter.toString(), 60, 8, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);
    drawStringCenterTight(currentDown, 60, 20, COLOR_AMBER_ON, COLOR_AMBER_BRIGHT, COLOR_AMBER_DIM);

    // BOTTOM STRIP
    drawTimeoutDots(20, 38, homeTimeouts);
    drawTimeoutDots(100, 38, awayTimeouts);
  }

  // Marquee divider (always shown)
  for (let c = 1; c < BOARD_COLS - 1; c++) {
    drawDot(c, 45, false, null, null, '#150404');
  }

  // MARQUEE
  if (marqueeActive && marqueeText.length > 0) {
    const MARQUEE_ROW = 47;
    const MARQUEE_LEFT = 2;
    const MARQUEE_RIGHT = BOARD_COLS - 2;

    const now = performance.now();
    if (lastMarqueeTime > 0) {
      const dt = (now - lastMarqueeTime) / 1000;
      marqueeOffset -= dt * MARQUEE_SPEED;

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

// ── Game Logic ──

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
  gameClockInterval = setInterval(function () {
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
  var val = document.getElementById('ctrl-clock').value;
  var parts = val.split(':');
  if (parts.length === 2) {
    var m = parseInt(parts[0], 10) || 0;
    var s = parseInt(parts[1], 10) || 0;
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
  var dist = document.getElementById('ctrl-distance').value;
  currentDown = ordinal(n) + ' & ' + dist;
}

function applyDistance() {
  var dist = document.getElementById('ctrl-distance').value;
  currentDown = ordinal(selectedDown) + ' & ' + dist;
}

function setGoal() {
  currentDown = ordinal(selectedDown) + ' & GOAL';
}

function startPlayClock(seconds) {
  stopPlayClock();
  playClockSeconds = seconds;
  playClockInterval = setInterval(function () {
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

function toggleTimeMgmt() {
  showTimeMgmt = document.getElementById('ctrl-time-mgmt').checked;
  var timeSections = document.querySelectorAll('.time-mgmt-section');
  for (var i = 0; i < timeSections.length; i++) {
    timeSections[i].style.display = showTimeMgmt ? '' : 'none';
  }
  if (!showTimeMgmt) {
    stopGameClock();
    stopPlayClock();
  }
}

function useTimeout(team) {
  if (team === 'home' && homeTimeouts > 0) homeTimeouts--;
  else if (team === 'away' && awayTimeouts > 0) awayTimeouts--;
}

function resetTimeouts() {
  homeTimeouts = 3;
  awayTimeouts = 3;
}

function applyMarqueeTemplate() {
  var select = document.getElementById('ctrl-marquee-template');
  var val = select.value;
  var text = '';

  switch (val) {
    case 'home_timeout':
      text = homeName + ' TIMEOUT';
      break;
    case 'away_timeout':
      text = awayName + ' TIMEOUT';
      break;
    case 'home_td':
      text = '#XX ' + homeName + ' TOUCHDOWN';
      break;
    case 'away_td':
      text = '#XX ' + awayName + ' TOUCHDOWN';
      break;
    case 'home_fg':
      text = homeName + ' FIELD GOAL';
      break;
    case 'away_fg':
      text = awayName + ' FIELD GOAL';
      break;
    case 'home_safety':
      text = 'SAFETY - ' + homeName;
      break;
    case 'away_safety':
      text = 'SAFETY - ' + awayName;
      break;
    default:
      text = val;
  }

  if (text) {
    document.getElementById('ctrl-marquee-text').value = text;
  }
  // Reset dropdown so the same template can be picked again
  select.selectedIndex = 0;
}

function publishMarquee() {
  var text = document.getElementById('ctrl-marquee-text').value.toUpperCase();
  var repeats = parseInt(document.getElementById('ctrl-marquee-repeats').value, 10) || 1;
  if (!text.trim()) return;

  marqueeText = text;
  marqueeTextWidth = text.length * (CHAR_W + CHAR_GAP) - CHAR_GAP;
  marqueeOffset = BOARD_COLS;
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
  var el = document.getElementById('marquee-status');
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

// ── Init (runs after DOM is ready) ──

document.addEventListener('DOMContentLoaded', function () {
  canvas = document.getElementById('led-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  render();
});
