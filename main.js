/* keychain physics — the chain hangs from a string in the middle of the screen;
   moving the mouse (or dragging a finger) swings the charms around */

(function () {
  const root = document.getElementById('keychain');
  const charms = Array.from(document.querySelectorAll('.charm')).map((el, i) => ({
    el,
    base: parseFloat(el.dataset.base || 0),   // resting angle, degrees
    coup: parseFloat(el.dataset.coup || 1),   // how strongly mouse movement swings it
    k:    parseFloat(el.dataset.k || 0.05),   // spring stiffness back to rest
    angle: 0,
    vel: 0.8 + i * 0.4,                        // a little kick so it settles in alive
    phase: parseFloat(el.dataset.phase || i * 2.4), // where in the swing cycle it starts —
                                               // charms sharing a freq but π apart swing in opposition
    freq: parseFloat(el.dataset.freq || (0.0009 + i * 0.00028)),
    swing: parseFloat(el.dataset.swing || 1.5),// degrees it swings to EACH side, continuously
    lag: parseFloat(el.dataset.lag || 0.1),    // how quickly mouse movement builds up on it
    drag: parseFloat(el.dataset.drag || 0.90), // closer to 1 = swings keep going longer
    tiltf: parseFloat(el.dataset.tilt || 1),   // how much phone tilt moves it (0 = ignores tilt)
    wind: 0,                                   // smoothed mouse force
  }));

  // the face charm lifts out of the way when the user interacts
  const face = charms.find(c => c.el.classList.contains('charm-face'));
  const LIFT_MAG = 80;         // total angle when held aside (≈ horizontal)
  const LIFT_HOLD = 1000;      // ms of stillness before it swings back down
  let lastActive = -99999;
  let liftDir = 0;             // -1 left / +1 right, chosen when the lift starts

  let w = innerWidth, h = innerHeight;

  function anchorY() {
    // ring center: upper-middle, but always leaving room for the paper below
    return Math.max(90, Math.min(h * 0.30, h - 640));
  }

  // fixed hanging point, entered from above
  let px = w / 2;
  let py = -600;

  addEventListener('resize', () => { w = innerWidth; h = innerHeight; px = w / 2; });

  // mouse movement becomes a horizontal impulse on the charms
  let impulse = 0;
  let lastPointerX = null;

  addEventListener('pointermove', e => {
    if (lastPointerX !== null) impulse += e.clientX - lastPointerX;
    lastPointerX = e.clientX;
    lastActive = performance.now();
  }, { passive: true });

  addEventListener('pointerleave', () => { lastPointerX = null; });

  /* ---- phone tilt: the charms hang toward real gravity ---- */

  let tilt = 0;

  // add ?debug to the url to see what the sensor is doing
  const debugBox = location.search.includes('debug') ? (() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:60px;left:16px;z-index:99999;background:#111;color:#0f0;' +
      'font:12px monospace;padding:8px;border-radius:6px;pointer-events:none';
    d.textContent = 'debug: waiting for tap…';
    document.body.appendChild(d);
    return d;
  })() : null;

  function startTilt() {
    if (debugBox) debugBox.textContent = 'debug: listener on, no events yet';
    addEventListener('deviceorientation', e => {
      if (debugBox) debugBox.textContent =
        'gamma: ' + (e.gamma == null ? 'null' : e.gamma.toFixed(1)) + '  tilt: ' + tilt.toFixed(1);
      if (e.gamma == null) return;
      // gamma = left/right tilt in degrees; flip the sign if it feels backwards
      tilt = Math.max(-40, Math.min(40, e.gamma)) * 0.8;
    }, true);
  }

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS asks the visitor for motion access — must be inside a 'click'
    // (pointerdown doesn't count as a gesture for this api on ios)
    let asked = false;
    addEventListener('click', () => {
      if (asked) return;
      asked = true;
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (debugBox) debugBox.textContent = 'debug: permission ' + state;
          if (state === 'granted') startTilt();
        })
        .catch(err => {
          if (debugBox) debugBox.textContent = 'debug: permission error — ' + err;
        });
    });
  } else {
    startTilt(); // android and desktop browsers, no permission needed
  }

  function frame(t) {
    // settle onto the string
    px += (w / 2 - px) * 0.1;
    py += (anchorY() - py) * 0.08;
    root.style.transform = 'translate(' + px + 'px,' + py + 'px)';

    const kick = Math.max(-12, Math.min(12, impulse));
    impulse = 0; // consumed this frame

    const faceLifted = face && (t - lastActive < LIFT_HOLD);
    if (!faceLifted) liftDir = 0;

    for (const c of charms) {
      if (c === face && faceLifted) {
        // lift out of the way toward whichever side it's already closest to
        if (liftDir === 0) liftDir = (c.base + c.angle) >= 0 ? 1 : -1;
        c.angle += ((liftDir * LIFT_MAG - c.base) - c.angle) * 0.06;
        c.vel = 0;
      } else {
        // the resting point itself breathes: phone tilt + a slow left-right swing.
        // charms with the same data-freq but phases π apart swing in opposition.
        const target = tilt * c.tiltf + Math.sin(t * c.freq + c.phase) * c.swing;
        // mouse movement builds up as a smooth "wind" instead of hitting directly;
        // each charm has its own data-lag, so no two respond the same way
        c.wind += (kick * 0.007 * c.coup - c.wind) * c.lag;
        c.vel += -c.k * (c.angle - target) + c.wind;
        c.vel *= c.drag;                               // air drag
        c.angle = Math.max(-80, Math.min(80, c.angle + c.vel));
      }
      c.el.style.transform = 'rotate(' + (c.base + c.angle) + 'deg)';
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- word-by-word text entrance (from the about page) ---- */

  document.querySelectorAll('.split-words').forEach(block => {
    let delay = 0.6;
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (/^\s+$/.test(part) || part === '') {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'split-word';
            span.textContent = part;
            span.style.setProperty('--d', delay.toFixed(2) + 's');
            span.style.setProperty('--wr', ((Math.random() * 8) - 4).toFixed(1) + 'deg');
            delay += 0.045;
            frag.appendChild(span);
          }
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    Array.from(block.childNodes).forEach(walk);
  });

  /* ---- click ripple (from the main site) ---- */

  /* ---- RSVP link, kept encoded so the public repo isn't searchable for it.
     to change it: run  btoa("https://the-new-link")  in the browser console
     and paste the result between the quotes below ---- */

  document.querySelector('.rsvp-float').href =
    atob('aHR0cHM6Ly9wYXJ0aWZ1bC5jb20vZS85eEFiVjlOMTlyUDV4UTF1bkdpdz9jPUQ3TnNXWjhR');

  // a tap/click gives the charms a swing (this is the phone interaction)
  addEventListener('pointerdown', e => {
    lastActive = performance.now(); // taps lift the face aside too
    const dir = e.clientX < px ? 1 : -1; // swing away from the tap side
    for (const c of charms) {
      if (c === face) continue; // the face glides aside instead of being kicked
      c.vel += dir * (1.0 + Math.random() * 1.0) * c.coup;
    }

    const r = document.createElement('div');
    r.className = 'click-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });
})();
