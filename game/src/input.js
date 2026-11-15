// Keyboard and mouse state, kept apart from the game rules so the world can be
// stepped by the autopilot in screenshots without any real input.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.pressedKeys = new Set();
    this.queuedKeys = [];
    this.queuedClicks = [];
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        // Read the position from this event, not the last mousemove: a click
        // with no prior mouse movement must still land where it was made.
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (canvas.width / rect.width);
        const y = (event.clientY - rect.top) * (canvas.height / rect.height);
        this.mouseX = x;
        this.mouseY = y;
        this.mouseDown = true;
        this.queuedClicks.push({ x, y });
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.pressedKeys.add(event.key.toLowerCase());
      this.queuedKeys.push(event.key.toLowerCase());
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      this.mouseDown = false;
    });
  }

  /** Beam aim: the mouse position, or arrow keys nudging a virtual aim point. */
  aimPoint(fallback) {
    if (this.pressedKeys.has('arrowup')) fallback.y -= 6;
    if (this.pressedKeys.has('arrowdown')) fallback.y += 6;
    if (this.pressedKeys.has('arrowleft')) fallback.x -= 6;
    if (this.pressedKeys.has('arrowright')) fallback.x += 6;
    return { x: this.mouseX, y: this.mouseY };
  }

  get focusHeld() {
    return this.mouseDown || this.pressedKeys.has(' ');
  }

  takeKeys() {
    const keys = this.queuedKeys;
    this.queuedKeys = [];
    return keys;
  }

  takeClicks() {
    const clicks = this.queuedClicks;
    this.queuedClicks = [];
    return clicks;
  }
}
