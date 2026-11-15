// The night sea: ships, rocks, wraiths, the lamp oil and the score. Pure rules —
// no drawing, no input — so the screenshot autopilot can step it directly.
import {
  BEAM, FIELD, GATE, HEARTS, LAMP, NIGHT, NIGHTS, OIL, ROCK, SHIP, WRAITH,
} from './config.js';
import { angleDelta, clamp, mulberry32, range } from './random.js';

export const EVENT_DOCK = 1;
export const EVENT_WRECK = 2;
export const EVENT_BANISH = 4;
export const EVENT_NIGHT_CLEAR = 8;
export const EVENT_VICTORY = 16;
export const EVENT_OVER = 32;

export class World {
  constructor() {
    this.state = null;
    this.random = mulberry32(1);
    this.time = 0;
  }

  reset(seed = 1) {
    this.random = mulberry32(seed);
    this.time = 0;
    this.state = {
      seed,
      night: 1,
      hearts: HEARTS,
      score: 0,
      combo: 0,
      bestCombo: 0,
      docked: 0,
      lost: 0,
      banished: 0,
      oil: OIL.max,
      oilLocked: false,
      beamAngle: -0.12,
      focusing: false,
      ships: [],
      rocks: [],
      wraiths: [],
      spawnQueue: 0,
      spawnTimer: 1.2,
      wraithTimer: 6,
      nightClearTimer: 0,
      over: false,
      victory: false,
      message: '',
      messageTimer: 0,
    };
    this.buildNight();
  }

  /** Lay out this night's rocks and queue its ships. */
  buildNight() {
    const s = this.state;
    const random = this.random;
    const nightIndex = s.night - 1;
    s.rocks = [];
    const count = NIGHT.rocks[nightIndex];
    let guard = 0;
    while (s.rocks.length < count && guard < 200) {
      guard += 1;
      const rock = {
        x: range(random, 320, 1120),
        y: range(random, 70, 650),
        r: range(random, ROCK.minRadius, ROCK.maxRadius),
      };
      // Keep rocks out of the harbour mouth and away from each other.
      if (rock.x < 300) continue;
      if (s.rocks.some((other) => Math.hypot(other.x - rock.x, other.y - rock.y) < other.r + rock.r + 90)) continue;
      s.rocks.push(rock);
    }
    s.spawnQueue = NIGHT.ships[nightIndex];
    s.spawnTimer = 1.0;
    s.wraithTimer = NIGHT.wraithInterval[nightIndex];
    s.ships = [];
    s.wraiths = [];
  }

  get fogLevel() {
    return 0.22 + this.state.night * 0.07;
  }

  /** The beam's centre-line height at a given x. */
  beamYAt(x) {
    return LAMP.y + Math.tan(this.state.beamAngle) * (x - LAMP.x);
  }

  /** Is a point inside the beam cone (and range)? */
  inBeam(x, y, halfAngle) {
    const dx = x - LAMP.x;
    const dy = y - LAMP.y;
    const dist = Math.hypot(dx, dy);
    if (dist > BEAM.range || dx < 0) return false;
    return Math.abs(angleDelta(this.state.beamAngle, Math.atan2(dy, dx))) < halfAngle;
  }

  spawnShip() {
    const s = this.state;
    const random = this.random;
    const nightIndex = s.night - 1;
    s.ships.push({
      x: FIELD.width + 40,
      y: range(random, 90, 630),
      vy: 0,
      speed: SHIP.baseSpeed + SHIP.speedPerNight * nightIndex + range(random, 0, SHIP.speedJitter),
      driftFreq: range(random, 0.5, 1.1),
      driftPhase: range(random, 0, Math.PI * 2),
      state: 'sailing',
      bobPhase: range(random, 0, Math.PI * 2),
    });
    s.spawnQueue -= 1;
  }

  spawnWraith() {
    const s = this.state;
    const random = this.random;
    // Wraiths drift in from the open sea — never beside the harbour gate,
    // where a ship about to dock would have no time to be saved.
    const side = random();
    const wraith = side < 0.4
      ? { x: range(random, 500, 1200), y: -20 }
      : side < 0.8
        ? { x: range(random, 500, 1200), y: FIELD.height + 20 }
        : { x: FIELD.width + 20, y: range(random, 80, 640) };
    wraith.burn = 0;
    wraith.wobble = range(random, 0, Math.PI * 2);
    s.wraiths.push(wraith);
  }

  wreckShip(ship, reason) {
    const s = this.state;
    if (ship.state !== 'sailing') return EVENT_WRECK;
    ship.state = 'wrecked';
    ship.wreckReason = reason;
    ship.doneAt = this.time;
    s.hearts -= 1;
    s.lost += 1;
    s.combo = 0;
    if (s.hearts <= 0) {
      s.over = true;
      return EVENT_WRECK | EVENT_OVER;
    }
    return EVENT_WRECK;
  }

  dockShip(ship) {
    const s = this.state;
    if (ship.state !== 'sailing') return 0;
    ship.state = 'docked';
    ship.doneAt = this.time;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.docked += 1;
    s.score += SHIP.dockPoints * s.combo;
    s.message = s.combo > 1 ? `Safe harbour! Combo x${s.combo}` : 'Safe harbour!';
    s.messageTimer = 1.6;
    return EVENT_DOCK;
  }

  /** Advance the world one fixed step. Returns a bitmask of events. */
  step(dt, beamAngle, focusing) {
    const s = this.state;
    if (!s || s.over || s.victory) return 0;
    this.time += dt;
    let events = 0;
    s.beamAngle = beamAngle;
    s.focusing = focusing && !s.oilLocked;

    // Lamp oil: focusing drains it, resting refills it.
    if (s.focusing) {
      s.oil = Math.max(0, s.oil - OIL.focusDrain * dt);
      if (s.oil <= 0) s.oilLocked = true;
    } else {
      s.oil = Math.min(OIL.max, s.oil + OIL.regen * dt);
      if (s.oilLocked && s.oil >= OIL.refocusAt) s.oilLocked = false;
    }

    // Night-clear interstitial counts down, then the next night begins.
    if (s.nightClearTimer > 0) {
      s.nightClearTimer -= dt;
      if (s.nightClearTimer <= 0) {
        if (s.night >= NIGHTS) {
          s.victory = true;
          return EVENT_VICTORY;
        }
        s.night += 1;
        this.buildNight();
      }
      return events;
    }

    // Spawn ships and wraiths on their timers.
    if (s.spawnQueue > 0) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        this.spawnShip();
        s.spawnTimer = NIGHT.spawnInterval[s.night - 1] * range(this.random, 0.75, 1.25);
      }
    }
    s.wraithTimer -= dt;
    if (s.wraithTimer <= 0) {
      this.spawnWraith();
      s.wraithTimer = NIGHT.wraithInterval[s.night - 1] * range(this.random, 0.8, 1.2);
    }

    const halfAngle = s.focusing ? BEAM.focusHalfAngle : BEAM.halfAngle;
    const burnSeconds = s.focusing ? WRAITH.focusBurnSeconds : WRAITH.burnSeconds;

    for (const ship of s.ships) {
      if (ship.state !== 'sailing') continue;
      ship.x -= ship.speed * dt;
      ship.bobPhase += dt * 3;
      const guided = this.inBeam(ship.x, ship.y, halfAngle);
      // A rock dead ahead, close enough to see: the crew veers around it —
      // in the lamplight they see it in time; in the dark, often too late.
      // (Guided ships still dodge: the beam is what lets the crew see.)
      let avoidVy = null;
      for (const rock of s.rocks) {
        const ahead = ship.x - rock.x;
        if (ahead > 0 && ahead < 220 && Math.abs(ship.y - rock.y) < rock.r + 60) {
          avoidVy = (ship.y >= rock.y ? 1 : -1) * 90;
          break;
        }
      }
      if (avoidVy !== null) {
        ship.vy += (avoidVy - ship.vy) * Math.min(1, dt * 5);
      } else if (guided) {
        const targetVy = clamp((this.beamYAt(ship.x) - ship.y) * BEAM.steer, -BEAM.maxSteerSpeed, BEAM.maxSteerSpeed);
        ship.vy += (targetVy - ship.vy) * Math.min(1, dt * 6);
      } else {
        // Unguided, a ship still creeps toward the channel it knows — slowly,
        // and the fog's drift keeps pulling it off course.
        const selfVy = clamp((360 - ship.y) * SHIP.selfSteer, -SHIP.selfSteerMax, SHIP.selfSteerMax);
        const drift = Math.sin(this.time * ship.driftFreq + ship.driftPhase) * SHIP.driftAmp;
        ship.vy += (selfVy + drift - ship.vy) * Math.min(1, dt * 2);
      }
      ship.y = clamp(ship.y + ship.vy * dt, 40, FIELD.height - 40);

      // Rock collision.
      for (const rock of s.rocks) {
        if (Math.hypot(ship.x - rock.x, ship.y - rock.y) < rock.r + SHIP.radius * 0.8) {
          events |= this.wreckShip(ship, 'rock');
          break;
        }
      }
      if (ship.state !== 'sailing') continue;

      // Harbour gate.
      if (ship.x <= GATE.x) {
        if (ship.y >= GATE.channelTop && ship.y <= GATE.channelBottom) {
          events |= this.dockShip(ship);
        } else {
          events |= this.wreckShip(ship, 'cliff');
        }
      }
    }

    // Wraiths hunt the nearest sailing ship; the beam burns them.
    for (const wraith of s.wraiths) {
      let prey = null;
      let preyDist = Infinity;
      for (const ship of s.ships) {
        if (ship.state !== 'sailing') continue;
        const dist = Math.hypot(ship.x - wraith.x, ship.y - wraith.y);
        if (dist < preyDist) { preyDist = dist; prey = ship; }
      }
      if (prey) {
        const speed = WRAITH.speed + WRAITH.speedPerNight * (s.night - 1);
        const wobble = Math.sin(this.time * 2 + wraith.wobble) * 12;
        wraith.x += ((prey.x - wraith.x) / Math.max(1, preyDist)) * speed * dt;
        wraith.y += ((prey.y + wobble - wraith.y) / Math.max(1, preyDist)) * speed * dt;
        if (preyDist < WRAITH.radius + SHIP.radius) {
          events |= this.wreckShip(prey, 'wraith');
          wraith.dead = true;
          continue;
        }
      }
      if (this.inBeam(wraith.x, wraith.y, halfAngle)) {
        wraith.burn += dt / burnSeconds;
        if (wraith.burn >= 1) {
          wraith.dead = true;
          s.banished += 1;
          s.score += WRAITH.banishPoints;
          events |= EVENT_BANISH;
        }
      } else {
        wraith.burn = Math.max(0, wraith.burn - dt * 0.5);
      }
    }
    s.wraiths = s.wraiths.filter((wraith) => !wraith.dead);
    // Docked and wrecked ships linger briefly (a splash, a cheer) then leave.
    s.ships = s.ships.filter((ship) => ship.state === 'sailing' || this.time - (ship.doneAt ?? this.time) < 1.2);

    if (s.messageTimer > 0) s.messageTimer -= dt;

    // Night cleared when nothing is left to arrive or sail.
    if (s.spawnQueue === 0 && !s.ships.some((ship) => ship.state === 'sailing') && !s.over) {
      if (s.night >= NIGHTS) {
        s.victory = true;
        return events | EVENT_VICTORY;
      }
      s.score += NIGHT.nightBonus;
      s.nightClearTimer = 2.6;
      s.message = `Night ${s.night} clear! +${NIGHT.nightBonus}`;
      s.messageTimer = 2.6;
      events |= EVENT_NIGHT_CLEAR;
    }
    return events;
  }
}
