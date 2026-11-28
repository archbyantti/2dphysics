// Procedural Web Audio: engine sound and impact sounds. Nothing is loaded from files.
// Audio starts on the first click or key press (browsers block sound before user input).

var audioCtx = null;
var master = null;      // Master gain; every sound goes through it
var noiseBuf = null;    // One second of white noise, reused by impact sounds
var engineNodes = null;

var IMPACT = {
  knockMinSpeed: 2.5,   // Box hits (px per 60 Hz step along the contact normal)
  thumpMinSpeed: 6,     // Car hitting the ground: only real drops, not rolling over seams
  minGap: 0.06          // Seconds between sounds of the same kind
};
var lastImpactAt = { knock: 0, thump: 0 };

// Initialize audio context on first user interaction
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.8;
    master.connect(audioCtx.destination);
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setUpEngineSound();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Soft-clipping curve that adds a little grit
function driveCurve(k) {
  var n = 1024, c = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = i * 2 / n - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

// Engine voice: three oscillators at the firing frequency (a sawtooth, a detuned sawtooth for width
// and a square an octave down for rumble), soft clipping, a low-pass that opens with rpm and throttle,
// and a tremolo at half the firing rate that gives the uneven "putt-putt" of a running engine.
function setUpEngineSound() {
  var t = audioCtx.currentTime;
  var mk = function (type, gain) {
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    g.gain.value = gain;
    o.connect(g);
    o.start(t);
    return { osc: o, gain: g };
  };
  var main = mk('sawtooth', 0.5), wide = mk('sawtooth', 0.25), sub = mk('square', 0.3);
  var shaper = audioCtx.createWaveShaper();
  shaper.curve = driveCurve(2.5);
  var filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  var trem = audioCtx.createGain();
  trem.gain.value = 0.7;
  var lfo = audioCtx.createOscillator(), lfoDepth = audioCtx.createGain();
  lfo.frequency.value = 14;
  lfoDepth.gain.value = 0.3;
  lfo.connect(lfoDepth);
  lfoDepth.connect(trem.gain);
  lfo.start(t);
  var out = audioCtx.createGain();
  out.gain.value = 0;
  [main, wide, sub].forEach(function (v) { v.gain.connect(shaper); });
  shaper.connect(filter);
  filter.connect(trem);
  trem.connect(out);
  out.connect(master);
  engineNodes = { main: main.osc, wide: wide.osc, sub: sub.osc, filter: filter, lfo: lfo, lfoDepth: lfoDepth, out: out };
}

// Update the engine voice from the car's engine state (rpm, gear, shifting, throttle) that the
// motor in car.js computes, so every gear change is heard; call once per frame
function updateEngineSound() {
  if (!car || !engineNodes) return;
  var now = audioCtx.currentTime;
  var eng = car.engine;
  var load = eng.rpm / MOTOR.redline;
  var fire = eng.rpm / 60 * 2;  // 4-cylinder 4-stroke: two firings per revolution, Hz
  var vol = eng.throttle ? 0.16 + 0.12 * load : 0.07 + 0.05 * load;
  if (eng.shiftMs > 0) vol *= 0.35;  // Lift during a gear change
  var k = 0.03;
  engineNodes.main.frequency.setTargetAtTime(fire, now, k);
  engineNodes.wide.frequency.setTargetAtTime(fire * 1.007, now, k);
  engineNodes.sub.frequency.setTargetAtTime(fire * 0.5, now, k);
  engineNodes.lfo.frequency.setTargetAtTime(fire * 0.5, now, k);
  engineNodes.lfoDepth.gain.setTargetAtTime(0.3 - 0.2 * load, now, k);  // Smoother at high rpm
  engineNodes.filter.frequency.setTargetAtTime(220 + eng.rpm * 0.2 + (eng.throttle ? 600 : 0), now, k);
  engineNodes.out.gain.setTargetAtTime(vol, now, k);
}

// Play impact sounds for new contacts that hit hard enough; call once after the engine exists.
// Only the speed along the contact normal counts, so rolling and sliding stay silent.
function setUpCollisionSound() {
  Events.on(engine, 'collisionStart', function (e) {
    if (!audioCtx) return;
    // Page clock, not audioCtx.currentTime, which stands still while the context is suspended
    var best = { knock: 0, thump: 0 };
    for (var i = 0; i < e.pairs.length; i++) {
      var pair = e.pairs[i];
      var hit = impactSpeed(pair);
      var kind = pairHas(pair, CAT.car) && pairHas(pair, CAT.ground) ? 'thump' : 'knock';
      var min = kind === 'thump' ? IMPACT.thumpMinSpeed : IMPACT.knockMinSpeed;
      if (hit >= min) best[kind] = Math.max(best[kind], hit);
    }
    var now = performance.now() / 1000;
    if (best.thump && now - lastImpactAt.thump >= IMPACT.minGap) {
      lastImpactAt.thump = now;
      playCollisionSound('thump', Math.min(1, 0.35 + (best.thump - IMPACT.thumpMinSpeed) / 12));
    }
    if (best.knock && now - lastImpactAt.knock >= IMPACT.minGap) {
      lastImpactAt.knock = now;
      playCollisionSound('knock', Math.min(1, best.knock / 10));
    }
  });
}

// Short burst of filtered noise
function noiseHit(type, freq, q, gain, decay, at) {
  var src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(at, Math.random() * 0.5);
  src.stop(at + decay + 0.02);
}

// Sine that drops in pitch, for the body of a hit
function toneHit(f0, f1, gain, decay, at) {
  var o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + decay);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + decay + 0.02);
}

// kind 'knock': a box hitting something (short wooden knock).
// kind 'thump': the car landing (deep thud plus a little suspension rattle). strength is 0..1.
function playCollisionSound(kind, strength) {
  if (!audioCtx) return;
  var s = strength === undefined ? 0.5 : strength;
  var at = audioCtx.currentTime + 0.005;
  if (kind === 'thump') {
    toneHit(110, 42, 0.7 * s, 0.35, at);
    noiseHit('lowpass', 380, 0.7, 0.45 * s, 0.14, at);
    noiseHit('bandpass', 2600, 4, 0.06 * s, 0.22, at + 0.02);
  } else {
    noiseHit('bandpass', 900 + Math.random() * 700, 3, 0.3 * s, 0.07, at);
    toneHit(240 + Math.random() * 60, 150, 0.15 * s, 0.07, at);
  }
}

// Initialize audio on first user interaction
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
