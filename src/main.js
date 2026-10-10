function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    countEl = document.getElementById('count');
    engine = Engine.create({
        enableSleeping: false,
        gravity: { y: 1.5, x: 0 },
        timing: { timeScale: 1.0 }
    });
    world = engine.world;
    addWalls();
    createCar();
    setUpCanvas();
    startLoop();
}

function startLoop(){function loop(){updateCarMotor();Engine.update(engine,1000/60);draw();requestAnimationFrame(loop);}loop();}

window.addEventListener('load', init);
