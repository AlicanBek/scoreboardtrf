// ── State ──

let homeScore = 0;
let awayScore = 0;
let gameClockSeconds = 15 * 60;
let gameClockInterval = null;
let playClockSeconds = 40;
let playClockInterval = null;

// ── DOM Refs ──

const $homeScore = document.getElementById('home-score');
const $awayScore = document.getElementById('away-score');
const $homeName = document.getElementById('home-name');
const $awayName = document.getElementById('away-name');
const $quarter = document.getElementById('quarter');
const $gameClock = document.getElementById('game-clock');
const $playClock = document.getElementById('play-clock');
const $downDistance = document.getElementById('down-distance');
const $homePossession = document.getElementById('home-possession');
const $awayPossession = document.getElementById('away-possession');

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

// ── Score ──

function changeScore(team, points) {
  if (team === 'home') {
    homeScore = Math.max(0, homeScore + points);
    $homeScore.textContent = formatScore(homeScore);
  } else {
    awayScore = Math.max(0, awayScore + points);
    $awayScore.textContent = formatScore(awayScore);
  }
}

// ── Team Names ──

function updateTeamNames() {
  const home = document.getElementById('ctrl-home-name').value.toUpperCase() || 'HOME';
  const away = document.getElementById('ctrl-away-name').value.toUpperCase() || 'AWAY';
  $homeName.textContent = home;
  $awayName.textContent = away;
}

// ── Game Clock ──

function startGameClock() {
  if (gameClockInterval) return;
  gameClockInterval = setInterval(() => {
    if (gameClockSeconds <= 0) {
      stopGameClock();
      return;
    }
    gameClockSeconds--;
    $gameClock.textContent = formatClock(gameClockSeconds);
  }, 1000);
}

function stopGameClock() {
  clearInterval(gameClockInterval);
  gameClockInterval = null;
}

function resetGameClock() {
  stopGameClock();
  gameClockSeconds = 15 * 60;
  $gameClock.textContent = formatClock(gameClockSeconds);
}

function setGameClock() {
  stopGameClock();
  const val = document.getElementById('ctrl-clock').value;
  const parts = val.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    gameClockSeconds = m * 60 + s;
    $gameClock.textContent = formatClock(gameClockSeconds);
  }
}

// ── Quarter ──

function setQuarter(q) {
  $quarter.textContent = q;
  if (q !== 'OT') {
    resetGameClock();
  }
}

// ── Down & Distance ──

function updateDownDistance() {
  const down = document.getElementById('ctrl-down').value;
  const dist = document.getElementById('ctrl-distance').value;
  $downDistance.textContent = ordinal(parseInt(down, 10)) + ' & ' + dist;
}

function setGoal() {
  const down = document.getElementById('ctrl-down').value;
  $downDistance.textContent = ordinal(parseInt(down, 10)) + ' & GOAL';
}

// ── Play Clock ──

function startPlayClock(seconds) {
  stopPlayClock();
  playClockSeconds = seconds;
  $playClock.textContent = playClockSeconds;
  $playClock.classList.remove('warning');

  playClockInterval = setInterval(() => {
    if (playClockSeconds <= 0) {
      stopPlayClock();
      $playClock.classList.add('warning');
      return;
    }
    playClockSeconds--;
    $playClock.textContent = playClockSeconds;

    if (playClockSeconds <= 5) {
      $playClock.classList.add('warning');
    }
  }, 1000);
}

function stopPlayClock() {
  clearInterval(playClockInterval);
  playClockInterval = null;
  $playClock.classList.remove('warning');
}

function resetPlayClock() {
  stopPlayClock();
  playClockSeconds = 40;
  $playClock.textContent = playClockSeconds;
}

// ── Possession ──

function setPossession(team) {
  $homePossession.classList.toggle('active', team === 'home');
  $awayPossession.classList.toggle('active', team === 'away');
}

// ── Reset Game ──

function resetGame() {
  homeScore = 0;
  awayScore = 0;
  $homeScore.textContent = '00';
  $awayScore.textContent = '00';
  $homeName.textContent = 'HOME';
  $awayName.textContent = 'AWAY';
  document.getElementById('ctrl-home-name').value = 'HOME';
  document.getElementById('ctrl-away-name').value = 'AWAY';
  setQuarter(1);
  resetGameClock();
  resetPlayClock();
  $downDistance.textContent = '1ST & 10';
  document.getElementById('ctrl-down').value = '1';
  document.getElementById('ctrl-distance').value = '10';
  setPossession(null);
}
