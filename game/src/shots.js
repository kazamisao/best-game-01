// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (aim the beam at the ship nearest the harbour, guiding it
// toward the channel; focus when a wraith closes in), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { GATE, LAMP, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const CHANNEL_MIDDLE = (GATE.channelTop + GATE.channelBottom) / 2;

/** Where the beam should point to shepherd `ship` toward the channel. */
function aimAtShip(ship) {
  const blend = ship.x < 520 ? 0.55 : 0.2;
  const desiredY = ship.y * (1 - blend) + CHANNEL_MIDDLE * blend;
  return Math.atan2(desiredY - LAMP.y, ship.x - LAMP.x);
}

/** The ship in the most danger: nearest the harbour gate, still sailing. */
function threatenedShip(world) {
  let best = null;
  for (const ship of world.state.ships) {
    if (ship.state !== 'sailing') continue;
    if (best === null || ship.x < best.x) best = ship;
  }
  return best;
}

/** The wraith closing in on a ship, if any — burning it comes first. */
function huntingWraith(world) {
  for (const wraith of world.state.wraiths) {
    for (const ship of world.state.ships) {
      if (ship.state !== 'sailing') continue;
      if (Math.hypot(wraith.x - ship.x, wraith.y - ship.y) < 340) return wraith;
    }
  }
  return null;
}

/**
 * One autopilot step: burn a hunting wraith first (aim at it, focus the beam),
 * else shepherd the ship nearest the harbour toward the channel.
 * `careless` aims at the middle of the sea and never focuses, so ships wreck
 * the way a hurried player loses them.
 */
function autopilotStep(world, careless) {
  const wraith = careless ? null : huntingWraith(world);
  if (wraith) {
    const angle = Math.atan2(wraith.y - LAMP.y, wraith.x - LAMP.x);
    return world.step(STEP, angle, true);
  }
  const ship = threatenedShip(world);
  let angle = 0;
  if (!careless && ship) angle = aimAtShip(ship);
  return world.step(STEP, angle, false);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world, seed = 1) {
  world.reset(seed);
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      autopilotStep(world, false);
      if (world.state.over) break;
    }
    return SCREEN_TITLE;
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const careless = name === 'end';
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = autopilotStep(world, careless);
    if (events & EVENT_OVER) return SCREEN_OVER;
    if (events & EVENT_VICTORY) return SCREEN_VICTORY;
    if (!careless && world.state.nightClearTimer > 0) break;
  }
  return SCREEN_PLAY;
}
