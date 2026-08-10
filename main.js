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
    vel: 0.8 + i * 0.4,                       // a little kick so it settles in alive
    phase: i * 2.4,                           // own idle rhythm, so charms never sync up
    freq: 0.0009 + i * 0.00028,
    lag: parseFloat(el.dataset.lag || 0.1),   // how quickly mouse movement builds up on it
    wind: 0,                                  // smoothed mouse force
  }));

  // the face charm lifts out of the way when the user interacts
  const face = charms.find(c => c.el.classList.contains('charm-face'));
  const LIFT_TOTAL = -80;      // total angle when held aside (≈ horizontal, up-left)
  const LIFT_HOLD = 1000;      // ms of stillness before it swings back down
  let lastActive = -99999;

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

  function frame(t) {
    // settle onto the string
    px += (w / 2 - px) * 0.1;
    py += (anchorY() - py) * 0.08;
    root.style.transform = 'translate(' + px + 'px,' + py + 'px)';

    const kick = Math.max(-12, Math.min(12, impulse));
    impulse = 0; // consumed this frame

    const faceLifted = face && (t - lastActive < LIFT_HOLD);

    for (const c of charms) {
      if (c === face && faceLifted) {
        // held aside: glide smoothly to the lifted position and stay still
        c.angle += ((LIFT_TOTAL - c.base) - c.angle) * 0.06;
        c.vel = 0;
      } else {
        // a barely-there idle sway, each charm on its own rhythm
        const idle = Math.sin(t * c.freq + c.phase) * 0.05;
        // mouse movement builds up as a smooth "wind" instead of hitting directly;
        // each charm has its own data-lag, so no two respond the same way
        c.wind += (kick * 0.007 * c.coup - c.wind) * c.lag;
        c.vel += -c.k * c.angle + c.wind + idle * c.coup;
        c.vel *= 0.90;                                 // air drag
        c.angle = Math.max(-80, Math.min(55, c.angle + c.vel));
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
