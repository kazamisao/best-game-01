// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Tidekeeper: a lighthouse keeper guides ships home through fog.
export const FIELD = { width: 1280, height: 720 };

// The lamp of the lighthouse, where the beam starts.
export const LAMP = { x: 116, y: 360 };

// The harbour gate: a ship that reaches this x inside the channel band docks
// safely; one that reaches it outside the band smashes into the cliffs.
export const GATE = { x: 150, channelTop: 290, channelBottom: 430 };

export const STEP = 1 / 60;

export const HEARTS = 3;
export const NIGHTS = 5;

export const SHIP = {
  radius: 16,
  baseSpeed: 36,
  speedPerNight: 5,
  speedJitter: 18,
  driftAmp: 14,
  dockPoints: 100,
  // Ships know where the harbour is and steer toward the channel on their own,
  // but slowly and blindly: the beam is what steers them properly and in time.
  selfSteer: 0.25,
  selfSteerMax: 30,
};

export const BEAM = {
  range: 980,
  halfAngle: 0.26,
  focusHalfAngle: 0.12,
  steer: 1.6,
  maxSteerSpeed: 95,
};

export const OIL = { max: 100, focusDrain: 30, regen: 12, refocusAt: 25 };

export const ROCK = { minRadius: 18, maxRadius: 34 };

export const WRAITH = {
  radius: 14,
  speed: 40,
  speedPerNight: 4,
  burnSeconds: 0.9,
  focusBurnSeconds: 0.4,
  banishPoints: 25,
};

export const NIGHT = {
  ships: [6, 8, 10, 12, 14],
  spawnInterval: [2.6, 2.3, 2.0, 1.8, 1.6],
  rocks: [4, 5, 6, 7, 8],
  wraithInterval: [11, 8, 6.5, 5.5, 5],
  nightBonus: 250,
};

export const PALETTE = {
  seaDeep: '#0a1a2e',
  sea: '#10283f',
  seaLight: '#16344f',
  fog: '#9db8c9',
  rock: '#3a4552',
  rockTop: '#57657a',
  beam: '#ffe9a8',
  beamCore: '#fff6d8',
  lampGlow: '#ffd76a',
  shipHull: '#c98f4e',
  shipSail: '#f2ead8',
  shipLight: '#ffd76a',
  wraith: '#7a5cff',
  wraithCore: '#b7a6ff',
  heart: '#ff6b6b',
  heartEmpty: '#3a4552',
  hud: '#eef4f8',
  muted: '#8fa8bb',
  panel: '#0d1f33',
  panelEdge: '#2b4a68',
  gold: '#ffd76a',
  danger: '#ff6b6b',
  dawn: '#ffb36b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'tidekeeper.best';
