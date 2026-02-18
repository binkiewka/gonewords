/* ========================================
   Untangle Your Mind — Game Engine (Remastered)
   Premium Visuals: Additive Blending, Procedural Sprites, Particles
   ======================================== */

(() => {
    'use strict';

    // ── Configuration ──────────────────────────
    const DIFFICULTY = {
        easy: { minNodes: 5, maxNodes: 7 },
        medium: { minNodes: 8, maxNodes: 12 },
        hard: { minNodes: 13, maxNodes: 18 }
    };

    const CONFIG = {
        nodeRadius: 16,
        hitRadius: 32,
        dragRadius: 22,
        padding: 60,
        // Colors
        colorSafe: { r: 74, g: 232, b: 196 }, // Cyan/Green - Uncrossed
        colorDanger: { r: 255, g: 50, b: 80 }, // Saturated Red - Crossed
        colorDrag: { r: 255, g: 213, b: 107 }, // Gold
        colorNode: { r: 139, g: 122, b: 255 }, // Purple

        // Effects
        beamWidth: 3,
        glowWidth: 20,
        packetInterval: 15, // Frames between packet spawns
        scrollSpeed: 0.15
    };

    // ── State ──────────────────────────────────
    let canvas, ctx, bgCanvas, bgCtx;
    let W, H;
    let nodes = [];
    let edges = [];
    let crossingCount = 0;
    let moveCount = 0;
    let level = 1;
    let currentDifficulty = 'easy';
    let dragNode = null;
    let hoverNode = null;
    let dragOffsetX = 0, dragOffsetY = 0;
    let gameState = 'title'; // title | playing | won
    let animFrame = null;
    let particles = []; // Explosion/Spark particles
    let bgStars = [];
    let time = 0;

    // Asset Cache (Off-screen canvases)
    const assets = {
        nodeNormal: null, // Fallback/Title
        nodeDrag: null,
        nodeHover: null,
        nodeHarmonized: null,   // Safe/Cyan
        nodeUnharmonized: null  // Danger/Red
    };

    // ── DOM Refs ───────────────────────────────
    const titleScreen = document.getElementById('title-screen');
    const gameHud = document.getElementById('game-hud');
    const winScreen = document.getElementById('win-screen');
    const levelCounter = document.getElementById('level-counter');
    const crossCounter = document.getElementById('crossing-counter');
    const moveCounter = document.getElementById('move-counter');
    const winMoves = document.getElementById('win-moves');

    // ── Audio Controller ───────────────────────
    const AudioController = {
        tracks: [
            'audio/Piano-Concerto-no.-21-in-C-major-K.-467-II.-Andante(chosic.com).mp3',
            'audio/Spring-Flowers(chosic.com).mp3',
            'audio/Sunset-Landscape(chosic.com).mp3',
            'audio/keys-of-moon-white-petals(chosic.com).mp3'
        ],
        currentTrackIdx: 0,
        audioElement: null,
        isMuted: false,
        isInitialized: false,

        init() {
            if (this.isInitialized) return;

            this.audioElement = new Audio();
            this.audioElement.loop = false;
            this.audioElement.volume = 0.4; // Reasonable background level

            // Auto-play next track when current one ends
            this.audioElement.addEventListener('ended', () => {
                this.playNext();
            });

            // Shuffle tracks initially
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

            if (!this.isMuted) {
                this.audioElement.play().catch(e => console.log("Audio play failed (interaction needed):", e));
            }
        },

        startMusic() {
            if (!this.isInitialized) this.init();
            // If already playing, do nothing. If paused or not started, start.
            if (this.audioElement.paused) {
                this.audioElement.src = this.tracks[this.currentTrackIdx];
                this.audioElement.play().catch(e => console.log("Audio play failed:", e));
            }
        },

        toggleMute() {
            this.isMuted = !this.isMuted;
            if (this.audioElement) {
                this.audioElement.muted = this.isMuted;
                if (!this.isMuted && this.audioElement.paused) {
                    this.audioElement.play().catch(e => console.log("Audio resume failed:", e));
                }
            }
            return this.isMuted;
        }
    };

    // ── Init ───────────────────────────────────
    function init() {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d'); // Alpha needed for transparency over bgCanvas
        bgCanvas = document.getElementById('bgCanvas');
        bgCtx = bgCanvas.getContext('2d');

        // Generate procedural assets once
        generateAssets();

        resize();
        window.addEventListener('resize', resize);

        // Pointer events
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
        canvas.style.touchAction = 'none';

        // UI
        document.querySelectorAll('.diff-btn[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentDifficulty = btn.dataset.difficulty;
                level = 1;
                // Start music on first interaction
                AudioController.startMusic();
                startGame();
            });
        });

        document.getElementById('btn-skip').addEventListener('click', () => { level++; startGame(); });

        const btnMute = document.getElementById('btn-mute');
        btnMute.addEventListener('click', () => {
            const isMuted = AudioController.toggleMute();
            btnMute.textContent = isMuted ? 'Unmute' : 'Mute';
        });

        document.getElementById('btn-menu').addEventListener('click', showTitle);
        document.getElementById('btn-next').addEventListener('click', () => { level++; startGame(); });
        document.getElementById('btn-win-menu').addEventListener('click', showTitle);

        initBgStars();
        showTitle();
        loop();
    }

    // ── Asset Generation ───────────────────────
    function generateAssets() {
        assets.nodeNormal = createGlowingOrb(CONFIG.colorNode, 32);
        assets.nodeHover = createGlowingOrb({ r: 180, g: 160, b: 255 }, 36);
        assets.nodeDrag = createGlowingOrb(CONFIG.colorDrag, 40);

        // New assets for harmonization states
        assets.nodeHarmonized = createGlowingOrb(CONFIG.colorSafe, 32);
        assets.nodeUnharmonized = createGlowingOrb(CONFIG.colorDanger, 32);
    }

    function createGlowingOrb(color, radius) {
        const s = radius * 4; // Texture size
        const c = document.createElement('canvas');
        c.width = s;
        c.height = s;
        const x = c.getContext('2d');
        const cx = s / 2, cy = s / 2;

        // Core glow
        const g = x.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 2);
        g.addColorStop(0, `rgba(255, 255, 255, 1)`);
        g.addColorStop(0.1, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
        g.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`);
        g.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        x.globalCompositeOperation = 'screen';
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx, cy, radius * 2, 0, Math.PI * 2);
        x.fill();

        // Hard core
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#fff';
        x.beginPath();
        x.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
        x.fill();

        return c;
    }

    // ── Screen Management ──────────────────────
    function showScreen(screen) {
        [titleScreen, gameHud, winScreen].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    function showTitle() {
        gameState = 'title';
        showScreen(titleScreen);
        nodes = [];
        edges = [];
    }

    function showWin() {
        gameState = 'won';
        winMoves.textContent = moveCount;
        createWinParticles();
        showScreen(winScreen);
    }

    // ── Resize ─────────────────────────────────
    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        // High DPI for crisp lines
        canvas.width = W * devicePixelRatio;
        canvas.height = H * devicePixelRatio;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        // Optimize rendering context
        ctx.scale(devicePixelRatio, devicePixelRatio);

        bgCanvas.width = W * devicePixelRatio;
        bgCanvas.height = H * devicePixelRatio;
        bgCanvas.style.width = W + 'px';
        bgCanvas.style.height = H + 'px';
        bgCtx.scale(devicePixelRatio, devicePixelRatio);

        drawBackground();
    }

    // ── Background ─────────────────────────────
    function initBgStars() {
        bgStars = [];
        for (let i = 0; i < 300; i++) {
            bgStars.push({
                x: Math.random() * 3000,
                y: Math.random() * 3000,
                r: Math.random() < 0.85 ? 0.5 + Math.random() * 0.5 : 1 + Math.random() * 0.8, // mostly tiny, a few slightly bigger
                alpha: Math.random() * 0.5 + 0.15,
                twinkleSpeed: 0.01 + Math.random() * 0.03,
                twinklePhase: Math.random() * Math.PI * 2
            });
        }
    }

    function drawBackground() {
        // Pure dark sky
        const g = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
        g.addColorStop(0, '#0a0e1a');  // Very dark navy
        g.addColorStop(0.4, '#050810');
        g.addColorStop(1, '#000000');  // Pure black at edges
        bgCtx.fillStyle = g;
        bgCtx.fillRect(0, 0, W, H);

        // Very subtle nebula hints
        drawNebula(bgCtx, W * 0.2, H * 0.3, 400, 'rgba(40, 80, 120, 0.015)');
        drawNebula(bgCtx, W * 0.8, H * 0.7, 500, 'rgba(60, 50, 120, 0.02)');
    }

    function drawNebula(c, x, y, r, color) {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'transparent');
        c.fillStyle = g;
        c.globalCompositeOperation = 'screen';
        c.fillRect(x - r, y - r, r * 2, r * 2);
        c.globalCompositeOperation = 'source-over';
    }

    // ── Puzzle Logic ───────────────────────────
    function startGame() {
        const diff = DIFFICULTY[currentDifficulty];
        const nodeCount = randInt(diff.minNodes, diff.maxNodes);
        generatePuzzle(nodeCount);
        moveCount = 0;
        crossingCount = countCrossings();
        updateHud();
        gameState = 'playing';
        showScreen(gameHud);
    }

    function generatePuzzle(n) {
        // Circle layout (solved state)
        const cx = W / 2, cy = H / 2;
        // Generate edges
        edges = [];
        for (let i = 0; i < n; i++) edges.push({ a: i, b: (i + 1) % n });

        // Extra edges
        const extra = Math.floor(n * 0.6);
        let attempts = 0;
        while (edges.length < n + extra && attempts < n * 10) {
            attempts++;
            const a = randInt(0, n - 1);
            const b = (a + randInt(2, n - 2)) % n;
            if (a === b) continue;
            if (!edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
                edges.push({ a, b });
            }
        }

        // Randomize positions (tangled state) until crossed
        nodes = new Array(n).fill(0).map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
        let retries = 0;
        do {
            nodes.forEach(n => {
                n.x = CONFIG.padding + Math.random() * (W - CONFIG.padding * 2);
                n.y = CONFIG.padding + 60 + Math.random() * (H - CONFIG.padding * 2 - 120);
            });
            retries++;
        } while (countCrossings() === 0 && retries < 20);
    }

    // ── Geometry ───────────────────────────────
    function segmentsIntersect(p1, p2, p3, p4) {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
        if (det === 0) return false;
        const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
        const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }

    function edgesIntersect(e1, e2) {
        if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) return false;
        return segmentsIntersect(nodes[e1.a], nodes[e1.b], nodes[e2.a], nodes[e2.b]);
    }

    function countCrossings() {
        let count = 0;
        for (let i = 0; i < edges.length; i++) {
            for (let j = i + 1; j < edges.length; j++) {
                if (edgesIntersect(edges[i], edges[j])) count++;
            }
        }
        return count;
    }

    function isEdgeCrossed(idx) {
        const e1 = edges[idx];
        for (let j = 0; j < edges.length; j++) {
            if (j === idx) continue;
            if (edgesIntersect(e1, edges[j])) return true;
        }
        return false;
    }

    // ── Input ──────────────────────────────────
    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onPointerDown(e) {
        if (gameState !== 'playing') return;
        const p = getPos(e);
        // Hit test
        for (let i = nodes.length - 1; i >= 0; i--) {
            const dx = p.x - nodes[i].x, dy = p.y - nodes[i].y;
            if (dx * dx + dy * dy <= CONFIG.hitRadius * CONFIG.hitRadius) {
                dragNode = i;
                dragOffsetX = nodes[i].x - p.x;
                dragOffsetY = nodes[i].y - p.y;
                canvas.setPointerCapture(e.pointerId);
                canvas.style.cursor = 'grabbing';
                return;
            }
        }
    }

    function onPointerMove(e) {
        if (gameState !== 'playing') return;
        const p = getPos(e);
        if (dragNode !== null) {
            nodes[dragNode].x = clamp(p.x + dragOffsetX, CONFIG.padding, W - CONFIG.padding);
            nodes[dragNode].y = clamp(p.y + dragOffsetY, CONFIG.padding, H - CONFIG.padding);
            crossingCount = countCrossings();
            updateHud();
        } else {
            // Hover check
            hoverNode = null;
            canvas.style.cursor = 'default';
            for (let i = nodes.length - 1; i >= 0; i--) {
                const dx = p.x - nodes[i].x, dy = p.y - nodes[i].y;
                if (dx * dx + dy * dy <= CONFIG.hitRadius * CONFIG.hitRadius) {
                    hoverNode = i;
                    canvas.style.cursor = 'grab';
                    break;
                }
            }
        }
    }

    function onPointerUp() {
        if (dragNode !== null) {
            moveCount++;
            crossingCount = countCrossings();
            updateHud();
            if (crossingCount === 0) setTimeout(showWin, 200);
            dragNode = null;
            canvas.style.cursor = (hoverNode !== null) ? 'grab' : 'default';
        }
    }

    // ── HUD ────────────────────────────────────
    function updateHud() {
        levelCounter.textContent = level;
        moveCounter.textContent = moveCount;
        crossCounter.textContent = crossingCount;
        crossCounter.style.color = crossingCount === 0
            ? `rgb(${CONFIG.colorSafe.r}, ${CONFIG.colorSafe.g}, ${CONFIG.colorSafe.b})`
            : `rgb(${CONFIG.colorDanger.r}, ${CONFIG.colorDanger.g}, ${CONFIG.colorDanger.b})`;
    }

    // ── Rendering ──────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Draw Stars
        ctx.globalCompositeOperation = 'source-over';
        for (const s of bgStars) {
            // Constant subtle twinkle, no massive pulsing
            const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase) * 0.2 + 0.8;
            const a = s.alpha * twinkle;
            ctx.globalAlpha = Math.max(0.05, a);
            ctx.fillStyle = '#d0cce8';
            ctx.beginPath();
            ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (gameState === 'title') return;

        // ── Draw Beams (Static Vector Style) ──
        // Standard blending for solid, calm look
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Uncrossed Edges (Safe)
        const crossedEdges = [];
        const uncrossedEdges = [];
        // Track unsafe nodes (any node connected to a crossed edge)
        const nodeIsUnsafe = new Uint8Array(nodes.length);

        for (let i = 0; i < edges.length; i++) {
            if (isEdgeCrossed(i)) {
                crossedEdges.push(edges[i]);
                nodeIsUnsafe[edges[i].a] = 1;
                nodeIsUnsafe[edges[i].b] = 1;
            } else {
                uncrossedEdges.push(edges[i]);
            }
        }

        // Draw Uncrossed (Cyan/Green)
        drawStaticLines(uncrossedEdges, CONFIG.colorSafe);

        // Draw Crossed (Red) on top
        drawStaticLines(crossedEdges, CONFIG.colorDanger);

        // ── Draw Nodes ──
        // Solid rendering, no screen blend
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            let sprite;

            // Determine base sprite
            if (i === dragNode) {
                sprite = assets.nodeDrag;
            } else if (i === hoverNode) {
                sprite = assets.nodeHover;
            } else {
                // If the node is connected to ANY crossed edge, it's unsafe (Red)
                // Otherwise, it's harmonized (Cyan)
                sprite = nodeIsUnsafe[i] ? assets.nodeUnharmonized : assets.nodeHarmonized;
            }

            ctx.drawImage(sprite, n.x - sprite.width / 4, n.y - sprite.height / 4, sprite.width / 2, sprite.height / 2);
        }

        // ── Draw Particles (Simple Fade) ──
        drawParticles();
    }

    function drawStaticLines(edgeList, color) {
        if (edgeList.length === 0) return;

        const r = color.r, g = color.g, b = color.b;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'butt';

        // Layered glow halos: wide → narrow, low opacity compounds into bloom
        const glowLayers = [
            { width: 24, alpha: 0.024 }, // 0.04 * 0.6
            { width: 18, alpha: 0.025 }, // 0.05 * 0.5
            { width: 12, alpha: 0.035 }, // 0.07 * 0.5
            { width: 7, alpha: 0.045 }, // 0.09 * 0.5
            { width: 4, alpha: 0.07 },  // 0.14 * 0.5
        ];

        for (const layer of glowLayers) {
            ctx.lineWidth = layer.width;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${layer.alpha})`;
            ctx.beginPath();
            for (const e of edgeList) {
                ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
                ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
            }
            ctx.stroke();
        }

        // Rough energy strands — many jagged, segmented strokes per edge
        for (const e of edgeList) {
            const p1 = nodes[e.a];
            const p2 = nodes[e.b];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;

            // Perpendicular normal
            const nx = -dy / len;
            const ny = dx / len;

            // How many segments to break the line into (more = rougher)
            const segments = Math.max(6, Math.floor(len / 18));

            // Draw 10-14 rough strands per edge
            const strandCount = 10 + Math.floor(seededRandom(e.a * 13 + e.b * 7) * 5);

            for (let s = 0; s < strandCount; s++) {
                const seed = e.a * 97 + e.b * 53 + s * 31;

                // Each strand has a base lateral offset from center
                const baseOffset = (seededRandom(seed) - 0.5) * 18;
                // Strand width and alpha vary
                const strandWidth = 0.4 + seededRandom(seed + 1) * 2.2;
                const strandAlpha = (0.04 + seededRandom(seed + 2) * 0.10) * 0.5; // Reduced by 50%

                // Brighter central strands (those with small offset)
                const centralness = 1 - Math.abs(baseOffset) / 12;
                const finalAlpha = strandAlpha + centralness * 0.08 * 0.5; // Reduced by 50%
                const finalWidth = strandWidth + centralness * 0.8;

                ctx.beginPath();
                ctx.lineWidth = finalWidth;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha.toFixed(3)})`;

                // Walk along the edge in segments, jittering perpendicular
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    // Base position along the line
                    let px = p1.x + dx * t;
                    let py = p1.y + dy * t;

                    // Jitter: perpendicular noise that varies per segment
                    const jitterSeed = seed + i * 71;
                    const jitter = (seededRandom(jitterSeed) - 0.5) * 10;
                    // Offset fades near endpoints so strands converge at nodes
                    const fade = Math.sin(t * Math.PI); // 0 at ends, 1 at middle
                    const totalOffset = (baseOffset + jitter) * fade;

                    px += nx * totalOffset;
                    py += ny * totalOffset;

                    if (i === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // Deterministic random for stable wisps (no flickering)
    function seededRandom(seed) {
        const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    // ── Particles (Simple Fade) ─────────────────
    function createWinParticles() {
        particles = [];
        for (const n of nodes) {
            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 3;
                particles.push({
                    x: n.x, y: n.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.02, // Faster decay
                    color: Math.random() > 0.5 ? CONFIG.colorSafe : CONFIG.colorNode,
                    size: 2 + Math.random() * 2
                });
            }
        }
    }

    function drawParticles() {
        ctx.globalCompositeOperation = 'source-over'; // No additive flash
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) { particles.splice(i, 1); continue; }

            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Game Loop ──────────────────────────────
    function loop() {
        time++;
        draw();
        animFrame = requestAnimationFrame(loop);
    }

    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
