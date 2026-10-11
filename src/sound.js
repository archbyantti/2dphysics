// Audio context for generating sounds
var audioCtx = null;
var engineOscillator = null;
var engineGain = null;
var engineFilter = null;

// Initialize audio context on first user interaction
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        setupEngineSound();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Set up engine sound with oscillators
function setupEngineSound() {
    engineOscillator = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineFilter = audioCtx.createBiquadFilter();

    // Low-pass filter for engine rumble
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 150;
    engineFilter.Q.value = 1;

    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 50;

    // Connect nodes
    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);

    // Initial volume
    engineGain.gain.value = 0;
    engineOscillator.start();
}

// Update engine sound based on car speed and input
function updateEngineSound() {
    if (!car || !engineOscillator) return;

    var speed = Math.abs(car.speed);
    var maxSpeed = 10;
    var inputActive = input.accel || input.rev;
    
    // Calculate engine pitch (idle at 50 Hz, up to 400 Hz at max speed)
    var pitch = 50 + speed / maxSpeed * 350;
    pitch = Math.max(50, Math.min(400, pitch));
    
    // Update oscillator frequency
    engineOscillator.frequency.setTargetAtTime(pitch, audioCtx.currentTime, 0.1);
    
    // Adjust volume based on speed and input (idle volume when input is active)
    var volume = Math.min(0.3, speed / maxSpeed * 0.3);
    if (inputActive) {
        volume = Math.max(volume, 0.05);  // Minimum volume when input is pressed
    }
    engineGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.1);
    
    // Open filter slightly more at higher speeds for more "revving" sound
    var filterFreq = 150 + speed / maxSpeed * 100;
    engineFilter.frequency.setTargetAtTime(filterFreq, audioCtx.currentTime, 0.1);
}

// Play collision sound
function playCollisionSound() {
    if (!audioCtx) return;

    var now = audioCtx.currentTime;

    // Create fresh oscillator and nodes for this collision event
    var oscillator = audioCtx.createOscillator();
    var filter = audioCtx.createBiquadFilter();
    var gain = audioCtx.createGain();

    filter.type = 'highpass';
    filter.frequency.value = 800;

    // Connect: oscillator -> filter -> gain -> destination
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    // Start oscillator
    oscillator.start();

    // Create a quick pitch sweep for impact sound
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    // Volume envelope
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    // Stop oscillator after 0.3 seconds
    oscillator.stop(now + 0.3);
}

// Initialize audio on first user interaction
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
