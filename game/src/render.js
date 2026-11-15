// All drawing on one canvas: the night sea, the lighthouse and its beam, the
// ships, the wraiths, the HUD and every menu screen. Nothing here touches the
// rules; it only reads the world.
import { BEAM, FIELD, FONT, GATE, HEARTS, LAMP, NIGHTS, PALETTE, SHIP } from './config.js';
import { angleDelta, clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

/** Clickable buttons, laid out in logical coordinates. */
export const BUTTONS = {
  start: { x: 490, y: 520, w: 300, h: 64 },
  restart: { x: 490, y: 500, w: 300, h: 64 },
  resume: { x: 490, y: 430, w: 300, h: 64 },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 600) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -6, -11, 0, -5);
  ctx.bezierCurveTo(6, -11, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
  ctx.fill();
  ctx.restore();
}

function drawShip(ctx, ship, lit, time) {
  const bob = Math.sin(ship.bobPhase) * 2;
  ctx.save();
  ctx.translate(ship.x, ship.y + bob);
  if (ship.state === 'wrecked') {
    ctx.rotate(0.5);
    ctx.globalAlpha = 0.7;
  }
  const alpha = lit ? 1 : 0.45;
  ctx.globalAlpha *= alpha;
  // Hull.
  ctx.fillStyle = PALETTE.shipHull;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(18, 0);
  ctx.lineTo(12, 10);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();
  // Sail.
  ctx.fillStyle = PALETTE.shipSail;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(0, -2);
  ctx.lineTo(-11, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -22);
  ctx.lineTo(2, -2);
  ctx.lineTo(12, -2);
  ctx.closePath();
  ctx.fill();
  // Mast + lantern.
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.fillStyle = PALETTE.shipLight;
  ctx.beginPath();
  ctx.arc(0, -28, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Wreck splash rings.
  if (ship.state === 'wrecked') {
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 244, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 22 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWraith(ctx, wraith, time) {
  const pulse = 1 + Math.sin(time * 5 + wraith.wobble) * 0.15;
  ctx.save();
  ctx.translate(wraith.x, wraith.y);
  ctx.scale(pulse, pulse);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  glow.addColorStop(0, 'rgba(183, 166, 255, 0.85)');
  glow.addColorStop(0.5, 'rgba(122, 92, 255, 0.35)');
  glow.addColorStop(1, 'rgba(122, 92, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  // Wisp body: two eyes in a ragged cloak.
  ctx.fillStyle = PALETTE.wraith;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(12, -6, 10, 6);
  ctx.lineTo(5, 12);
  ctx.lineTo(0, 7);
  ctx.lineTo(-5, 12);
  ctx.lineTo(-10, 6);
  ctx.quadraticCurveTo(-12, -6, 0, -14);
  ctx.fill();
  ctx.fillStyle = '#efeaff';
  ctx.beginPath();
  ctx.arc(-4, -4, 2, 0, Math.PI * 2);
  ctx.arc(4, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  // Burn ring: how much of it the beam has already dissolved.
  if (wraith.burn > 0.05) {
    ctx.strokeStyle = PALETTE.beam;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + wraith.burn * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLighthouse(ctx, time) {
  // Rocky point the lighthouse stands on.
  ctx.fillStyle = PALETTE.rock;
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(150, 240);
  ctx.lineTo(170, 480);
  ctx.lineTo(150, 560);
  ctx.lineTo(0, 620);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.rockTop;
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(150, 240);
  ctx.lineTo(120, 300);
  ctx.lineTo(0, 250);
  ctx.closePath();
  ctx.fill();
  // Tower: pale bands.
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.moveTo(96, 360);
  ctx.lineTo(136, 360);
  ctx.lineTo(130, 250);
  ctx.lineTo(102, 250);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(99, 300, 34, 22);
  ctx.fillRect(101, 262, 30, 12);
  // Gallery + lamp.
  ctx.fillStyle = '#2a3040';
  ctx.fillRect(96, 242, 40, 10);
  const flicker = 0.85 + Math.sin(time * 7) * 0.08 + Math.sin(time * 13) * 0.05;
  const glow = ctx.createRadialGradient(LAMP.x, LAMP.y, 4, LAMP.x, LAMP.y, 90);
  glow.addColorStop(0, `rgba(255, 214, 106, ${0.55 * flicker})`);
  glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lampGlow;
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // Harbour dock lights marking the safe channel.
  for (const y of [GATE.channelTop, GATE.channelBottom]) {
    ctx.fillStyle = '#7dff9a';
    ctx.beginPath();
    ctx.arc(158, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeam(ctx, world, time) {
  const s = world.state;
  const halfAngle = s.focusing ? BEAM.focusHalfAngle : BEAM.halfAngle;
  const length = BEAM.range;
  const angle = s.beamAngle;
  const spread = Math.tan(halfAngle) * length;
  const tipX = LAMP.x + Math.cos(angle) * length;
  const tipY = LAMP.y + Math.sin(angle) * length;
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(LAMP.x, LAMP.y, tipX, tipY);
  grad.addColorStop(0, s.focusing ? 'rgba(255, 246, 216, 0.5)' : 'rgba(255, 233, 168, 0.34)');
  grad.addColorStop(1, 'rgba(255, 233, 168, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(LAMP.x, LAMP.y);
  ctx.lineTo(tipX + perpX * spread, tipY + perpY * spread);
  ctx.lineTo(tipX - perpX * spread, tipY - perpY * spread);
  ctx.closePath();
  ctx.fill();
  // Bright core.
  const coreSpread = spread * 0.35;
  const coreGrad = ctx.createLinearGradient(LAMP.x, LAMP.y, tipX, tipY);
  coreGrad.addColorStop(0, 'rgba(255, 246, 216, 0.5)');
  coreGrad.addColorStop(1, 'rgba(255, 246, 216, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.moveTo(LAMP.x, LAMP.y);
  ctx.lineTo(tipX + perpX * coreSpread, tipY + perpY * coreSpread);
  ctx.lineTo(tipX - perpX * coreSpread, tipY - perpY * coreSpread);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  void time;
}

function drawFog(ctx, world, time) {
  const s = world.state;
  const density = world.fogLevel;
  ctx.save();
  // Drifting fog banks.
  for (let i = 0; i < 5; i += 1) {
    const speed = 6 + i * 3;
    const x = ((i * 260 + time * speed) % 1500) - 110;
    const y = 120 + i * 110;
    const fog = ctx.createRadialGradient(x, y, 10, x, y, 260);
    fog.addColorStop(0, `rgba(157, 184, 201, ${0.10 * density * 4})`);
    fog.addColorStop(1, 'rgba(157, 184, 201, 0)');
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.ellipse(x, y, 260, 90, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vignette: the edges of the night stay dark.
  const vignette = ctx.createRadialGradient(640, 360, 300, 640, 360, 900);
  vignette.addColorStop(0, 'rgba(4, 10, 20, 0)');
  vignette.addColorStop(1, `rgba(4, 10, 20, ${0.35 + density * 0.4})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

function drawHud(ctx, world) {
  const s = world.state;
  // Top bar.
  ctx.fillStyle = 'rgba(10, 26, 46, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, 52);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 52, FIELD.width, 2);
  for (let i = 0; i < HEARTS; i += 1) drawHeart(ctx, 34 + i * 30, 26, 20, i < s.hearts);
  text(ctx, `SCORE ${s.score}`, 220, 27, 22, PALETTE.hud, 'left', 700);
  text(ctx, `NIGHT ${s.night} / ${NIGHTS}`, 560, 27, 22, PALETTE.hud, 'left', 700);
  text(ctx, `DOCKED ${s.docked}   LOST ${s.lost}`, 800, 27, 20, PALETTE.muted, 'left');
  if (s.combo > 1) text(ctx, `COMBO x${s.combo}`, 1120, 27, 22, PALETTE.gold, 'left', 700);
  // Oil gauge, bottom left.
  ctx.fillStyle = 'rgba(10, 26, 46, 0.72)';
  roundRect(ctx, 16, 668, 220, 36, 8);
  ctx.fill();
  text(ctx, 'OIL', 32, 686, 15, PALETTE.muted, 'left', 700);
  const oilW = 150 * (s.oil / 100);
  ctx.fillStyle = s.oilLocked ? PALETTE.danger : PALETTE.gold;
  roundRect(ctx, 70, 678, Math.max(0, oilW), 16, 6);
  ctx.fill();
  if (s.oilLocked) text(ctx, 'REFILLING…', 150, 686, 13, PALETTE.danger, 'left', 700);
  text(ctx, 'Mouse: aim beam   Hold click / Space: focus   P: pause   M: sound', 1270, 686, 14, PALETTE.muted, 'right');
  // Transient message.
  if (s.messageTimer > 0 && s.message) {
    ctx.globalAlpha = clamp(s.messageTimer, 0, 1);
    text(ctx, s.message, 640, 96, 30, PALETTE.gold, 'center', 700);
    ctx.globalAlpha = 1;
  }
  // Night-clear banner.
  if (s.nightClearTimer > 0) {
    ctx.fillStyle = 'rgba(10, 26, 46, 0.6)';
    ctx.fillRect(0, 300, FIELD.width, 90);
    text(ctx, `NIGHT ${s.night} CLEAR`, 640, 330, 34, PALETTE.gold, 'center', 800);
    text(ctx, `Night bonus +250 — the next night brings more ships`, 640, 366, 18, PALETTE.hud);
  }
}

function drawPanel(ctx, title, lines, button, buttonLabel) {
  ctx.fillStyle = 'rgba(4, 10, 20, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, 340, 150, 600, 420, 16);
  ctx.fill();
  ctx.stroke();
  text(ctx, title, 640, 210, 44, PALETTE.hud, 'center', 800);
  let y = 280;
  for (const line of lines) {
    text(ctx, line, 640, y, 20, line.startsWith('—') ? PALETTE.muted : PALETTE.hud, 'center', line.startsWith('—') ? 400 : 600);
    y += 34;
  }
  if (button) {
    ctx.fillStyle = PALETTE.gold;
    roundRect(ctx, button.x, button.y, button.w, button.h, 12);
    ctx.fill();
    text(ctx, buttonLabel, button.x + button.w / 2, button.y + button.h / 2 + 1, 26, '#1a2a3a', 'center', 800);
  }
}

/** Draw the sea and everything on it for the play screen. */
export function drawGame(ctx, world, time) {
  const s = world.state;
  const sea = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sea.addColorStop(0, '#0d2036');
  sea.addColorStop(0.5, PALETTE.sea);
  sea.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Moonlit wave lines.
  ctx.strokeStyle = 'rgba(140, 180, 210, 0.10)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 9; row += 1) {
    const y = 90 + row * 70;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 32) {
      const wave = Math.sin(x * 0.02 + time * 0.8 + row * 1.7) * 4;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  // Rocks.
  for (const rock of s.rocks) {
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath();
    ctx.moveTo(rock.x - rock.r, rock.y + rock.r * 0.4);
    ctx.lineTo(rock.x - rock.r * 0.5, rock.y - rock.r * 0.8);
    ctx.lineTo(rock.x + rock.r * 0.6, rock.y - rock.r * 0.7);
    ctx.lineTo(rock.x + rock.r, rock.y + rock.r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.rockTop;
    ctx.beginPath();
    ctx.moveTo(rock.x - rock.r * 0.5, rock.y - rock.r * 0.8);
    ctx.lineTo(rock.x + rock.r * 0.6, rock.y - rock.r * 0.7);
    ctx.lineTo(rock.x + rock.r * 0.2, rock.y - rock.r * 0.2);
    ctx.lineTo(rock.x - rock.r * 0.2, rock.y - rock.r * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  drawLighthouse(ctx, time);
  drawBeam(ctx, world, time);
  const halfAngle = s.focusing ? BEAM.focusHalfAngle : BEAM.halfAngle;
  for (const ship of s.ships) {
    const lit = world.inBeam(ship.x, ship.y, halfAngle) || ship.x < GATE.x + 40;
    drawShip(ctx, ship, lit, time);
  }
  for (const wraith of s.wraiths) drawWraith(ctx, wraith, time);
  drawFog(ctx, world, time);
  drawHud(ctx, world);
}

export function drawTitle(ctx, world, best) {
  drawGame(ctx, world, 0);
  ctx.fillStyle = 'rgba(4, 10, 20, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'TIDEKEEPER', 640, 170, 84, PALETTE.gold, 'center', 800);
  text(ctx, 'Guide the ships home through the fog — five nights, one lamp.', 640, 240, 24, PALETTE.hud);
  text(ctx, 'Aim the beam with the mouse. Ships inside the light steer toward it.', 640, 300, 20, PALETTE.muted);
  text(ctx, 'Hold click / Space to focus the beam and burn wraiths — it drinks oil.', 640, 330, 20, PALETTE.muted);
  text(ctx, 'Dock ships inside the green-lit channel. Rocks, cliffs and wraiths wreck them.', 640, 360, 20, PALETTE.muted);
  text(ctx, 'Lose 3 ships and the night takes the harbour. Survive all 5 nights to see dawn.', 640, 390, 20, PALETTE.muted);
  if (best > 0) text(ctx, `Best score: ${best}`, 640, 440, 22, PALETTE.gold, 'center', 700);
  ctx.fillStyle = PALETTE.gold;
  roundRect(ctx, BUTTONS.start.x, BUTTONS.start.y, BUTTONS.start.w, BUTTONS.start.h, 12);
  ctx.fill();
  text(ctx, 'LIGHT THE LAMP', BUTTONS.start.x + 150, BUTTONS.start.y + 33, 26, '#1a2a3a', 'center', 800);
  text(ctx, 'or press Enter', 640, 610, 16, PALETTE.muted);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 10, 20, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'PAUSED', 640, 300, 56, PALETTE.hud, 'center', 800);
  text(ctx, 'Press P to resume, or click below', 640, 360, 20, PALETTE.muted);
  ctx.fillStyle = PALETTE.gold;
  roundRect(ctx, BUTTONS.resume.x, BUTTONS.resume.y, BUTTONS.resume.w, BUTTONS.resume.h, 12);
  ctx.fill();
  text(ctx, 'RESUME', BUTTONS.resume.x + 150, BUTTONS.resume.y + 33, 26, '#1a2a3a', 'center', 800);
}

export function drawOver(ctx, world, best) {
  const s = world.state;
  drawGame(ctx, world, 0);
  drawPanel(ctx, 'THE HARBOUR IS LOST', [
    `Night ${s.night} — ${s.docked} ships docked, ${s.lost} lost, ${s.banished} wraiths banished.`,
    `Score: ${s.score}   Best: ${Math.max(best, s.score)}`,
    '— the fog keeps what the light could not save —',
    'Press R or click below to keep the lamp.',
  ], BUTTONS.restart, 'TRY AGAIN');
}

export function drawVictory(ctx, world, best) {
  const s = world.state;
  // Dawn breaks over the sea.
  const dawn = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  dawn.addColorStop(0, '#2b4a68');
  dawn.addColorStop(0.55, '#c97e4e');
  dawn.addColorStop(1, '#ffb36b');
  ctx.fillStyle = dawn;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#fff3d0';
  ctx.beginPath();
  ctx.arc(640, 420, 60, 0, Math.PI * 2);
  ctx.fill();
  drawPanel(ctx, 'DAWN BREAKS', [
    `All five nights survived — ${s.docked} ships home, ${s.lost} lost.`,
    `Score: ${s.score}   Best: ${Math.max(best, s.score)}`,
    `Best combo x${s.bestCombo}   Wraiths banished: ${s.banished}`,
    '— the keeper kept the light, and the sea gave the ships back —',
    'Press R or click below to play again.',
  ], BUTTONS.restart, 'PLAY AGAIN');
}

export { angleDelta };
