// Tidekeeper: the lighthouse keeper's game loop. Owns the screen state machine
// (title, play, pause, over, victory), wires input and sound into the world,
// and draws one frame per animation frame at a fixed 60 Hz simulation step.
import { BEST_KEY, FIELD, GATE, LAMP, STEP } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World, EVENT_BANISH, EVENT_DOCK, EVENT_NIGHT_CLEAR, EVENT_OVER, EVENT_VICTORY, EVENT_WRECK } from './world.js';
import {
  BUTTONS, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
  drawGame, drawOver, drawPause, drawTitle, drawVictory,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = new Input(canvas);
const sounds = new SoundBank();
const world = new World();

let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  best = 0;
}
let beamAngle = -0.12;
let aimX = 700;
let aimY = 300;
let accumulator = 0;
let lastTime = 0;

function saveBest() {
  if (world.state.score > best) {
    best = world.state.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Private mode or no storage: the score still shows this session.
    }
  }
}

function startGame() {
  sounds.unlock();
  sounds.click();
  world.reset(1 + Math.floor(Math.random() * 100000));
  beamAngle = -0.12;
  screen = SCREEN_PLAY;
}

function endSounds(events) {
  if (events & EVENT_DOCK) sounds.dock();
  if (events & EVENT_WRECK) sounds.wreck();
  if (events & EVENT_BANISH) sounds.banish();
  if (events & EVENT_NIGHT_CLEAR) sounds.nightClear();
  if (events & EVENT_VICTORY) sounds.nightClear();
  if (events & EVENT_OVER) saveBest();
}

function pointInButton(point, button) {
  return point.x >= button.x && point.x <= button.x + button.w
    && point.y >= button.y && point.y <= button.y + button.h;
}

function handleKeys() {
  for (const key of input.takeKeys()) {
    if (key === 'm') {
      sounds.unlock();
      sounds.setMuted(!sounds.muted);
      continue;
    }
    if (screen === SCREEN_TITLE && (key === 'enter' || key === ' ')) startGame();
    else if ((screen === SCREEN_OVER || screen === SCREEN_VICTORY) && (key === 'r' || key === 'enter')) startGame();
    else if (screen === SCREEN_PLAY && key === 'p') screen = SCREEN_PAUSE;
    else if (screen === SCREEN_PAUSE && key === 'p') screen = SCREEN_PLAY;
    else if (screen === SCREEN_PLAY && key === 'r') startGame();
  }
}

function handleClicks() {
  for (const click of input.takeClicks()) {
    sounds.unlock();
    if (screen === SCREEN_TITLE && pointInButton(click, BUTTONS.start)) startGame();
    else if ((screen === SCREEN_OVER || screen === SCREEN_VICTORY) && pointInButton(click, BUTTONS.restart)) startGame();
    else if (screen === SCREEN_PAUSE && pointInButton(click, BUTTONS.resume)) screen = SCREEN_PLAY;
  }
}

function frame(now) {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now;
  handleKeys();
  handleClicks();
  if (screen !== SCREEN_PLAY) {
    sounds.setHum(false, false);
    if (screen === SCREEN_TITLE) drawTitle(ctx, world, best);
    else if (screen === SCREEN_PAUSE) { drawGame(ctx, world, now / 1000); drawPause(ctx); }
    else if (screen === SCREEN_OVER) drawOver(ctx, world, best);
    else if (screen === SCREEN_VICTORY) drawVictory(ctx, world, best);
    return;
  }
  // Ease the beam toward the mouse; arrow keys nudge the aim point too.
  const aim = input.aimPoint({ x: aimX, y: aimY });
  aimX = aim.x;
  aimY = aim.y;
  const targetAngle = Math.atan2(aimY - LAMP.y, aimX - LAMP.x);
  const clamped = Math.max(-1.35, Math.min(1.35, targetAngle));
  beamAngle += (clamped - beamAngle) * Math.min(1, dt * 14);
  sounds.setHum(true, world.state.focusing);
  accumulator += dt;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    const events = world.step(STEP, beamAngle, input.focusHeld);
    endSounds(events);
    if (world.state.over) screen = SCREEN_OVER;
    else if (world.state.victory) { screen = SCREEN_VICTORY; saveBest(); }
  }
  drawGame(ctx, world, now / 1000);
}

// A staged screenshot (?shot=start|play|end&seed=N): play the real rules
// forward with the autopilot, draw the scene once, and hold it still.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = Number(params.get('seed') ?? 1) || 1;
  const shotScreen = stageShot(shot, world, seed);
  if (shotScreen === SCREEN_TITLE) drawTitle(ctx, world, best);
  else if (shotScreen === SCREEN_OVER) drawOver(ctx, world, best);
  else if (shotScreen === SCREEN_VICTORY) drawVictory(ctx, world, best);
  else drawGame(ctx, world, 0);
  document.title = `Tidekeeper — shot ${shot}`;
} else {
  world.reset(7);
  window.requestAnimationFrame(frame);
}
