/**
 * Pattern Ripple - Core Logic
 */

// --- Canvas & Context ---
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

const targetCanvas = document.getElementById('targetCanvas');
const targetCtx = targetCanvas.getContext('2d');

// --- UI Elements ---
const uiOverlay = document.getElementById('ui-overlay');
const titleScreen = document.getElementById('title-screen');
const gameHud = document.getElementById('game-hud');
const winScreen = document.getElementById('win-screen');

const diffBtns = document.querySelectorAll('.diff-btn[data-difficulty]');
const btnMenu = document.getElementById('btn-menu');
const btnWinMenu = document.getElementById('btn-win-menu');
const btnNext = document.getElementById('btn-next');
const btnUndo = document.getElementById('btn-undo');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnMute = document.getElementById('btn-mute');
const levelCounter = document.getElementById('level-counter');

// --- Game State ---
let width = 0;
let height = 0;
let isPlaying = false;
let isPaused = false;
let isMuted = false;
let animationId = null;
let currentLevelIndex = 0;
let currentDifficulty = 'easy'; // easy, medium, hard
let tapsAllowed = 2; // from level

let ripples = []; // { x, y, radius, maxRadius, alpha, expanded }
let targetPattern = []; // [{x, y, r}] for scaled game rendering if needed
let relativeTargetPattern = []; // for drawing in the 120x120 box
let targetSignature = []; // Expected sorted relative distances of the target shape
const RIPPLE_SPEED = 0.5;
let MAX_RIPPLE_RADIUS = 800;
const INTERSECTION_TOLERANCE = 15; // px tolerance for distance match

// --- Levels definition (12 MVP levels) ---
const levels = [
    // Easy (2 taps)
    { taps: 2, targets: [[-50, 0], [50, 0]] },
    { taps: 2, targets: [[0, -60], [0, 60]] },
    { taps: 2, targets: [[-40, -40], [40, 40]] },
    { taps: 2, targets: [[-70, 0], [-30, 40], [30, -40], [70, 0]] }, // actually with 2 circles max intersections is 2, so let's keep targets possible: 2 intersections
    // Medium (3 taps)
    { taps: 3, targets: [[-40, -20], [40, -20], [0, 40]] },
    { taps: 3, targets: [[-50, 0], [0, 50], [50, 0]] },
    { taps: 3, targets: [[-30, -50], [30, -50], [0, 10]] },
    { taps: 3, targets: [[-60, -30], [0, 0], [60, -30]] },
    // Hard (4 taps)
    { taps: 4, targets: [[-40, -40], [40, -40], [-40, 40], [40, 40]] },
    { taps: 4, targets: [[-60, 0], [-20, -40], [20, 40], [60, 0]] },
    { taps: 4, targets: [[0, -60], [-40, -20], [40, 20], [0, 60]] },
    { taps: 4, targets: [[-30, -60], [30, -60], [-30, 60], [30, 60]] }
];

// --- Initialization ---

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    gameCanvas.width = width;
    gameCanvas.height = height;

    MAX_RIPPLE_RADIUS = Math.max(width, height) * 0.8;
}

window.addEventListener('resize', resize);
resize();

// --- Audio ---
const AudioController = {
    tracks: [
        '../untangle_your_mind/audio/Piano-Concerto-no.-21-in-C-major-K.-467-II.-Andante(chosic.com).mp3',
        '../untangle_your_mind/audio/Spring-Flowers(chosic.com).mp3',
        '../untangle_your_mind/audio/Sunset-Landscape(chosic.com).mp3',
        '../untangle_your_mind/audio/keys-of-moon-white-petals(chosic.com).mp3'
    ],
    currentTrackIdx: 0,
    audioElement: null,
    isInitialized: false,

    init() {
        if (this.isInitialized) return;

        this.audioElement = document.getElementById('bg-music') || new Audio();
        this.audioElement.loop = false;
        this.audioElement.volume = 0.4;

        this.audioElement.addEventListener('ended', () => {
            this.playNext();
        });

        this.shuffleTracks();
        this.isInitialized = true;
    },

    shuffleTracks() {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
    },

    playNext() {
        if (!this.isInitialized) this.init();

        this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
        this.audioElement.src = this.tracks[this.currentTrackIdx];

        if (!isMuted) {
            this.audioElement.play().catch(e => console.log("Audio play failed, likely needs interaction"));
        }
    },

    startMusic() {
        if (!this.isInitialized) this.init();
        if (this.audioElement.paused) {
            this.audioElement.src = this.tracks[this.currentTrackIdx];
            this.audioElement.play().catch(e => console.log("Audio play failed on start:", e));
        }
    },

    updateMuteState(muted) {
        if (this.audioElement) {
            this.audioElement.muted = muted;
            if (!muted && this.audioElement.paused) {
                this.audioElement.play().catch(e => console.log("Audio resume failed:", e));
            }
        }
    }
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDropSound() {
    if (isMuted || !audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    // Frequency sweep down to simulate water drop chunk
    osc.frequency.setValueAtTime(600 + Math.random() * 200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playWinSound() {
    if (isMuted || !audioCtx) return;

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    osc2.frequency.setValueAtTime(554.37, audioCtx.currentTime); // C#5

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 2.0);
    osc2.stop(audioCtx.currentTime + 2.0);
}

// --- Math & Logic ---

// Find intersections of two circles
function getCircleIntersections(c1, c2) {
    let dx = c2.x - c1.x;
    let dy = c2.y - c1.y;
    let d = Math.sqrt(dx * dx + dy * dy);

    // No intersection, or one circle is within the other
    if (d > c1.radius + c2.radius || d < Math.abs(c1.radius - c2.radius) || d === 0) {
        return [];
    }

    let a = (c1.radius * c1.radius - c2.radius * c2.radius + d * d) / (2 * d);
    let h = Math.sqrt(Math.max(0, c1.radius * c1.radius - a * a));

    let xm = c1.x + a * dx / d;
    let ym = c1.y + a * dy / d;

    let xs1 = xm + h * dy / d;
    let ys1 = ym - h * dx / d;

    let xs2 = xm - h * dy / d;
    let ys2 = ym + h * dx / d;

    // Output is two points (might be the same point if circles barely touch)
    return [{ x: xs1, y: ys1 }, { x: xs2, y: ys2 }];
}

function computeAllIntersections() {
    let pts = [];
    for (let i = 0; i < ripples.length; i++) {
        for (let j = i + 1; j < ripples.length; j++) {
            let intersect = getCircleIntersections(ripples[i], ripples[j]);
            pts.push(...intersect);
        }
    }
    return pts;
}

function getDistance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Compute the "signature" of a shape by building a sorted array of all its pairwise distances.
// By matching signatures, we gain translation and rotation invariance!
function getShapeSignature(points) {
    let dists = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            dists.push(getDistance(points[i], points[j]));
        }
    }
    return dists.sort((a, b) => a - b);
}

function getCombinations(arr, k) {
    let result = [];
    function backtrack(start, combo) {
        if (combo.length === k) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            backtrack(i + 1, combo);
            combo.pop(); // backtrack
        }
    }
    backtrack(0, []);
    return result;
}

function checkWinCondition(activeIntersections) {
    let n = targetPattern.length;
    let m = activeIntersections.length;

    // We need at least as many intersections as the target points
    if (m < n || n === 0) return false;

    // Generate all combinations of active intersections of size n
    let combinations = getCombinations(activeIntersections, n);

    for (let combo of combinations) {
        let comboSig = getShapeSignature(combo);
        let isMatch = true;

        for (let i = 0; i < targetSignature.length; i++) {
            if (Math.abs(comboSig[i] - targetSignature[i]) > INTERSECTION_TOLERANCE) {
                isMatch = false;
                break;
            }
        }
        if (isMatch) return true;
    }

    return false;
}

// --- Gameplay ---

function loadLevel(index) {
    ripples = [];
    isPaused = false;
    currentLevelIndex = index;
    levelCounter.textContent = index + 1;

    let lvl = levels[Math.min(index, levels.length - 1)];
    tapsAllowed = lvl.taps;

    // Scale targets from relative to screen center for game logic
    targetPattern = lvl.targets.map(t => ({
        x: width / 2 + t[0] * 3, // scale factor 3 for screen positioning
        y: height / 2 + t[1] * 3
    }));

    // Save relative coords for the mini-map drawing (canvas is 120x120, center is 60,60)
    relativeTargetPattern = lvl.targets.map(t => ({
        x: 60 + t[0] * 0.6, // scale up slightly for better visibility
        y: 60 + t[1] * 0.6
    }));

    // Fix 2-tap target logic: 2 taps means 2 circles, which can only intersect twice.
    if (tapsAllowed === 2 && targetPattern.length > 2) {
        targetPattern = targetPattern.slice(0, 2);
        relativeTargetPattern = relativeTargetPattern.slice(0, 2);
    }

    // Compute the target's distance signature for rotation-invariant matching
    targetSignature = getShapeSignature(targetPattern);

    updateHUD();
    drawTargetExample();
}

function drawTargetExample() {
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    // Draw background for the mini-map
    targetCtx.fillStyle = 'rgba(6, 17, 33, 0.4)';
    targetCtx.fillRect(0, 0, 120, 120);

    targetCtx.save();

    // Draw connecting lines 
    if (relativeTargetPattern.length > 1) {
        targetCtx.beginPath();
        targetCtx.moveTo(relativeTargetPattern[0].x, relativeTargetPattern[0].y);
        for (let i = 1; i < relativeTargetPattern.length; i++) {
            targetCtx.lineTo(relativeTargetPattern[i].x, relativeTargetPattern[i].y);
        }
        if (relativeTargetPattern.length > 2) {
            targetCtx.closePath();
        }
        targetCtx.lineWidth = 1;
        targetCtx.strokeStyle = 'rgba(74, 232, 196, 0.3)';
        targetCtx.setLineDash([3, 3]);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
    }

    // Draw points
    relativeTargetPattern.forEach(t => {
        targetCtx.beginPath();
        targetCtx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(74, 232, 196, 0.8)';
        targetCtx.fill();
    });

    targetCtx.restore();
}

function startGame(difficulty) {
    currentDifficulty = difficulty;
    titleScreen.classList.remove('active');
    winScreen.classList.remove('active');
    gameHud.classList.add('active');

    // Map difficulty to starting level index
    if (difficulty === 'easy') currentLevelIndex = 0;
    else if (difficulty === 'medium') currentLevelIndex = 4;
    else if (difficulty === 'hard') currentLevelIndex = 8;

    loadLevel(currentLevelIndex);
    isPlaying = true;

    AudioController.startMusic();

    if (animationId) cancelAnimationFrame(animationId);
    animate();
}

function handleTap(x, y) {
    if (!isPlaying || isPaused) return;

    // Check if we can still tap
    if (ripples.length >= tapsAllowed) return;

    ripples.push({
        x: x,
        y: y,
        radius: 0,
        maxRadius: MAX_RIPPLE_RADIUS,
        alpha: 1,
        expanded: false
    });

    playDropSound();
    updateHUD();
}

// --- Input Handling ---

gameCanvas.addEventListener('pointerdown', (e) => {
    handleTap(e.clientX, e.clientY);
});

// --- UI Buttons ---

diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        startGame(btn.dataset.difficulty);
    });
});

btnMenu.addEventListener('click', () => {
    isPlaying = false;
    gameHud.classList.remove('active');
    titleScreen.classList.add('active');
});

btnWinMenu.addEventListener('click', () => {
    isPlaying = false;
    winScreen.classList.remove('active');
    titleScreen.classList.add('active');
});

btnNext.addEventListener('click', () => {
    winScreen.classList.remove('active');
    gameHud.classList.add('active');
    loadLevel(currentLevelIndex + 1);
    isPlaying = true;
    animate();
});

btnUndo.addEventListener('click', () => {
    if (ripples.length > 0 && !isPaused) {
        ripples.pop();
        updateHUD();
    }
});

btnReset.addEventListener('click', () => {
    ripples = [];
    isPaused = false;
    updateHUD();
});

btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.textContent = isPaused ? 'Resume' : 'Pause';
    btnPause.classList.toggle('active', isPaused);
});

btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    btnMute.textContent = isMuted ? 'Unmute' : 'Mute';
    btnMute.classList.toggle('active', isMuted);
    AudioController.updateMuteState(isMuted);
});

function updateHUD() {
    btnUndo.style.opacity = ripples.length > 0 ? 1 : 0.5;
    btnUndo.style.pointerEvents = ripples.length > 0 ? 'auto' : 'none';

    // In a full implementation we might show current taps / max taps
}

// --- Main Loop ---

function renderPond() {
    // Clear canvas entirely to remove any ghosting from previous frames or levels
    ctx.clearRect(0, 0, width, height);

    // Dim the background image slightly so the bright ripples stand out more
    ctx.fillStyle = 'rgba(6, 17, 33, 0.4)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) return;

    // Draw Ripples
    ctx.save();
    ripples.forEach(r => {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);

        // Fading alpha near max radius
        let fade = 1 - Math.pow(r.radius / r.maxRadius, 2);

        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(120, 200, 255, ${Math.max(0, fade * 0.85)})`; // Brighter soft blue
        ctx.stroke();

        // Inner ring
        if (r.radius > 20) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius - 20, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = `rgba(74, 232, 196, ${Math.max(0, fade * 0.4)})`; // Teal
            ctx.stroke();
        }
    });
    ctx.restore();

    // Draw Intersections
    let activeIntersections = computeAllIntersections();
    ctx.save();

    // Draw connecting lines between active intersections if there's enough of them
    // and they closely match the target shape (this is an aesthetic touch).
    // Or simpler: just always connect active intersections if there are > 1.
    if (activeIntersections.length > 1) {
        ctx.beginPath();
        ctx.moveTo(activeIntersections[0].x, activeIntersections[0].y);
        for (let i = 1; i < activeIntersections.length; i++) {
            ctx.lineTo(activeIntersections[i].x, activeIntersections[i].y);
        }
        if (activeIntersections.length > 2) {
            ctx.closePath();
        }
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.stroke();
    }

    activeIntersections.forEach(pt => {
        ctx.beginPath();
        // Bright glow point
        let glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 18);
        glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
        glow.addColorStop(0.3, 'rgba(74, 232, 196, 0.9)');
        glow.addColorStop(1, 'rgba(74, 232, 196, 0)');

        ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
    });
    ctx.restore();

    // Check Win
    if (activeIntersections.length > 0 && checkWinCondition(activeIntersections)) {
        triggerWin();
    }
}

function animate() {
    if (!isPlaying) return;

    if (!isPaused) {
        // Update physics
        let winPossible = false;
        ripples.forEach(r => {
            if (r.radius < r.maxRadius) {
                r.radius += RIPPLE_SPEED;
            } else {
                r.expanded = true;
            }
        });

        // Remove ripples that are fully expanded? 
        // For this calm game, maybe they persist at max radius or slowly fade.
        // If we want a retry loop, user taps reset or undo.
    }

    renderPond();
    animationId = requestAnimationFrame(animate);
}

function triggerWin() {
    isPlaying = false;
    playWinSound();

    // Show win screen after small delay
    setTimeout(() => {
        gameHud.classList.remove('active');
        winScreen.classList.add('active');
    }, 500);
}
