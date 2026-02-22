// Garden Connect Core Logic

const UI = {
    grid: document.getElementById('grid'),
    levelText: document.getElementById('level-text'),
    btnUndo: document.getElementById('btn-undo'),
    btnMute: document.getElementById('btn-mute'),
    progressTrack: document.getElementById('progress-track'),
    successOverlay: document.getElementById('success-overlay'),
    btnNext: document.getElementById('btn-next'),
    modeOverlay: document.getElementById('mode-overlay'),
    btnEasy: document.getElementById('btn-easy'),
    btnNormal: document.getElementById('btn-normal'),
    btnHard: document.getElementById('btn-hard')
};

// Tile types and their connection points (N:0, E:1, S:2, W:3)
const TILE_DEFS = {
    'straight': [0, 2],
    'corner': [0, 1],
    't': [1, 2, 3],
    'cross': [0, 1, 2, 3],
    'end': [0],
    'empty': []
};

// ── Audio Controller ───────────────────────
const AudioController = {
    tracks: [
        '../untangle_your_mind/audio/Piano-Concerto-no.-21-in-C-major-K.-467-II.-Andante(chosic.com).mp3',
        '../untangle_your_mind/audio/Spring-Flowers(chosic.com).mp3',
        '../untangle_your_mind/audio/Sunset-Landscape(chosic.com).mp3',
        '../untangle_your_mind/audio/keys-of-moon-white-petals(chosic.com).mp3'
    ],
    currentTrackIdx: 0,
    audioElement: null,
    isMuted: false,
    isInitialized: false,

    init() {
        if (this.isInitialized) return;

        this.audioElement = new Audio();
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

        if (!this.isMuted) {
            this.audioElement.play().catch(e => console.log("Audio play failed:", e));
        }
    },

    startMusic() {
        if (!this.isInitialized) this.init();
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

let currentMode = 'normal';
const MAX_LEVELS = 10;

// Procedural Level Generator
function generateRandomLevel(size, numPlants) {
    let grid = Array(size).fill(0).map(() => Array(size).fill(0).map(() => ({
        visited: false,
        conns: []
    })));

    // Choose source edge (0=N, 1=E, 2=S, 3=W)
    let edge = Math.floor(Math.random() * 4);
    let source = [0, 0];
    if (edge === 0) source = [Math.floor(Math.random() * size), 0];
    else if (edge === 1) source = [size - 1, Math.floor(Math.random() * size)];
    else if (edge === 2) source = [Math.floor(Math.random() * size), size - 1];
    else source = [0, Math.floor(Math.random() * size)];

    let stack = [{ x: source[0], y: source[1], px: null, py: null, pDir: null }];
    let leaves = [];

    while (stack.length > 0) {
        let curr = stack.pop();
        if (grid[curr.y][curr.x].visited) continue;

        grid[curr.y][curr.x].visited = true;

        if (curr.px !== null) {
            grid[curr.y][curr.x].conns.push((curr.pDir + 2) % 4);
            grid[curr.py][curr.px].conns.push(curr.pDir);
        }

        let dirs = [0, 1, 2, 3];
        for (let i = 3; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }

        let hasChildren = false;
        for (let d of dirs) {
            let nx = curr.x + (d === 1 ? 1 : d === 3 ? -1 : 0);
            let ny = curr.y + (d === 2 ? 1 : d === 0 ? -1 : 0);

            if (nx >= 0 && nx < size && ny >= 0 && ny < size && !grid[ny][nx].visited) {
                // expanding paths. Always expand if no children yet.
                if (!hasChildren || Math.random() < 0.8) {
                    stack.push({ x: nx, y: ny, px: curr.x, py: curr.y, pDir: d });
                    hasChildren = true;
                }
            }
        }

        if (!hasChildren && (curr.x !== source[0] || curr.y !== source[1])) {
            leaves.push([curr.x, curr.y]);
        }
    }

    for (let i = leaves.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
    }

    let plants = leaves.slice(0, Math.max(1, Math.min(numPlants, leaves.length)));

    // Make sure source is a 1-connection "end" tile
    if (grid[source[1]][source[0]].conns.length > 1) {
        let keepDir = grid[source[1]][source[0]].conns[0];
        let dropConns = grid[source[1]][source[0]].conns.slice(1);
        grid[source[1]][source[0]].conns = [keepDir];

        dropConns.forEach(d => {
            let nx = source[0] + (d === 1 ? 1 : d === 3 ? -1 : 0);
            let ny = source[1] + (d === 2 ? 1 : d === 0 ? -1 : 0);
            let child = grid[ny][nx];
            let backDir = (d + 2) % 4;
            child.conns = child.conns.filter(c => c !== backDir);
        });
    }

    let tiles = [];
    let rotations = [];

    for (let r = 0; r < size; r++) {
        let tRow = [];
        let rRow = [];
        for (let c = 0; c < size; c++) {
            let cell = grid[r][c];
            let type = 'empty';
            let rot = 0;

            if (cell.conns.length > 0) {
                let mask = 0;
                cell.conns.forEach(d => mask |= (1 << d));

                if (cell.conns.length === 1) {
                    type = 'end';
                    if (mask === 1) rot = 0;
                    else if (mask === 2) rot = 1;
                    else if (mask === 4) rot = 2;
                    else if (mask === 8) rot = 3;
                } else if (cell.conns.length === 2) {
                    if (mask === 5 || mask === 10) {
                        type = 'straight';
                        rot = (mask === 5) ? 0 : 1;
                    } else {
                        type = 'corner';
                        if (mask === 3) rot = 0;
                        else if (mask === 6) rot = 1;
                        else if (mask === 12) rot = 2;
                        else if (mask === 9) rot = 3;
                    }
                } else if (cell.conns.length === 3) {
                    type = 't';
                    if (mask === 14) rot = 0;
                    if (mask === 13) rot = 1;
                    if (mask === 11) rot = 2;
                    if (mask === 7) rot = 3;
                } else if (cell.conns.length === 4) {
                    type = 'cross';
                    rot = 0;
                }
            } else {
                if (Math.random() < 0.15) {
                    let types = ['straight', 'corner', 'end'];
                    type = types[Math.floor(Math.random() * types.length)];
                }
            }

            tRow.push(type);
            rRow.push((type === 'empty') ? 0 : Math.floor(Math.random() * 4));
        }
        tiles.push(tRow);
        rotations.push(rRow);
    }

    return { size, source, plants, tiles, rotations };
}

let currentLevelIdx = 0;
let gridState = []; // [{type, rot, el, isFilled}]
let levelData = null;
let moveHistory = []; // for undo

function initLevel(index) {
    if (index >= MAX_LEVELS) {
        showGardenRestored();
        return;
    }

    let size, numPlants;
    if (currentMode === 'easy') {
        size = Math.min(3 + Math.floor(index / 3), 5);
        numPlants = 1 + Math.floor(index / 4);
    } else if (currentMode === 'normal') {
        size = Math.min(4 + Math.floor(index / 3), 6);
        numPlants = 2 + Math.floor(index / 3);
    } else { // hard
        size = Math.min(5 + Math.floor(index / 3), 7);
        numPlants = 3 + Math.floor(index / 2);
    }

    levelData = generateRandomLevel(size, numPlants);

    currentLevelIdx = index;
    UI.levelText.innerText = index + 1;

    UI.grid.style.gridTemplateColumns = `repeat(${levelData.size}, 1fr)`;
    UI.grid.style.gridTemplateRows = `repeat(${levelData.size}, 1fr)`;

    UI.successOverlay.classList.add('hidden');
    moveHistory = [];
    updateUndoBtn();

    buildGrid();
    checkFlow();

    UI.progressTrack.style.width = `${(index / MAX_LEVELS) * 100}%`;
}

function buildGrid() {
    UI.grid.innerHTML = '';
    gridState = [];

    for (let r = 0; r < levelData.size; r++) {
        for (let c = 0; c < levelData.size; c++) {
            const type = levelData.tiles[r][c];
            let initRot = levelData.rotations ? levelData.rotations[r][c] : Math.floor(Math.random() * 4);
            if (type === 'empty') initRot = 0;

            const isSource = levelData.source[0] === c && levelData.source[1] === r;
            const isPlant = levelData.plants.some(p => p[0] === c && p[1] === r);

            const tileState = {
                r, c, type,
                rot: initRot,
                isSource,
                isPlant,
                isFilled: false,
                el: null
            };

            tileState.el = createTileElement(tileState);
            UI.grid.appendChild(tileState.el);
            gridState.push(tileState);
        }
    }
}

function createTileElement(state) {
    const el = document.createElement('div');
    el.className = 'tile';
    if (state.type === 'empty' && !state.isSource && !state.isPlant) {
        el.style.opacity = 0;
        el.style.pointerEvents = 'none';
        return el;
    }

    let svgHtml = `<svg viewBox="0 0 100 100" width="100%" height="100%">`;

    // We draw paths FIRST so they render beneath the source/plant circles.
    const d = getSVGPathForType(state.type);
    if (d) {
        svgHtml += `<path d="${d}" class="pipe-path" id="pipe-${state.c}-${state.r}" />`;
    }

    if (state.isSource) {
        svgHtml += `<circle cx="50" cy="50" r="15" class="source-node" />`;
    }
    if (state.isPlant) {
        svgHtml += `<circle cx="50" cy="50" r="12" class="plant-node" id="plant-${state.c}-${state.r}" />`;
    }

    svgHtml += `</svg>`;
    el.innerHTML = svgHtml;

    el.addEventListener('click', () => {
        handleRotate(state);
    });

    state.el = el;
    updateTileVisuals(state, true);
    return el;
}

function getSVGPathForType(type) {
    switch (type) {
        case 'end': return "M 50 50 L 50 0";
        case 'straight': return "M 50 0 L 50 100";
        case 'corner': return "M 50 0 L 50 50 L 100 50";
        case 't': return "M 0 50 L 100 50 M 50 50 L 50 100";
        case 'cross': return "M 50 0 L 50 100 M 0 50 L 100 50";
        default: return "";
    }
}

function updateTileVisuals(state, noTransition = false) {
    const el = state.el;

    const innerSvg = el.querySelector('svg');
    if (innerSvg) {
        if (noTransition) innerSvg.style.transition = 'none';
        else innerSvg.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        innerSvg.style.transform = `rotate(${state.rot * 90}deg)`;

        if (noTransition) {
            setTimeout(() => innerSvg.style.transition = '', 50);
        }
    }

    const pipe = el.querySelector('.pipe-path');
    if (pipe) {
        if (state.isFilled) pipe.classList.add('filled');
        else pipe.classList.remove('filled');
    }

    if (state.isPlant) {
        const plantNode = el.querySelector('.plant-node');
        if (state.isFilled) plantNode.classList.add('bloomed');
        else plantNode.classList.remove('bloomed');
    }
}

function handleRotate(state) {
    moveHistory.push({ r: state.r, c: state.c, oldRot: state.rot });
    updateUndoBtn();

    state.rot = (state.rot + 1) % 4;
    updateTileVisuals(state);

    checkFlow();
}

function undo() {
    if (moveHistory.length === 0) return;
    const last = moveHistory.pop();
    const state = gridState.find(s => s.r === last.r && s.c === last.c);
    if (state) {
        state.rot = last.oldRot;
        updateTileVisuals(state);
        checkFlow();
    }
    updateUndoBtn();
}

function updateUndoBtn() {
    UI.btnUndo.disabled = moveHistory.length === 0;
}

function checkFlow() {
    gridState.forEach(s => s.isFilled = false);

    const sourceState = gridState.find(s => s.isSource);
    if (!sourceState) return;

    let queue = [sourceState];
    sourceState.isFilled = true;

    while (queue.length > 0) {
        const curr = queue.shift();
        const connections = getConnections(curr);

        connections.forEach(dir => {
            const neighbor = getNeighbor(curr, dir);
            if (neighbor && !neighbor.isFilled) {
                const neighborConns = getConnections(neighbor);
                const oppositeDir = (dir + 2) % 4;
                if (neighborConns.includes(oppositeDir)) {
                    neighbor.isFilled = true;
                    queue.push(neighbor);
                }
            }
        });
    }

    gridState.forEach(s => updateTileVisuals(s));

    const plants = gridState.filter(s => s.isPlant);
    if (plants.length > 0 && plants.every(p => p.isFilled)) {
        setTimeout(winLevel, 800);
    }
}

function getConnections(state) {
    const baseConns = TILE_DEFS[state.type];
    if (!baseConns) return [];
    return baseConns.map(d => (d + state.rot) % 4);
}

function getNeighbor(state, dir) {
    let nr = state.r;
    let nc = state.c;
    if (dir === 0) nr -= 1;
    else if (dir === 1) nc += 1;
    else if (dir === 2) nr += 1;
    else if (dir === 3) nc -= 1;

    if (nr < 0 || nc < 0 || nr >= levelData.size || nc >= levelData.size) return null;
    return gridState.find(s => s.r === nr && s.c === nc);
}

function winLevel() {
    UI.successOverlay.classList.remove('hidden');

    if (currentLevelIdx + 1 >= MAX_LEVELS) {
        UI.successOverlay.querySelector('h2').innerText = "Garden Restored!";
        UI.successOverlay.querySelector('p').innerText = "You brought life back to this area.";
        UI.btnNext.innerText = "Play Again";
    } else {
        UI.successOverlay.querySelector('h2').innerText = "Garden Flourishing";
        UI.successOverlay.querySelector('p').innerText = "The plants are happy.";
        UI.btnNext.innerText = "Next Puzzle";
    }
}

function showGardenRestored() {
    UI.successOverlay.querySelector('h2').innerText = "Garden Restored!";
    UI.successOverlay.querySelector('p').innerText = "You brought life back to this area.";
    UI.btnNext.innerText = "Play Again";
    UI.successOverlay.classList.remove('hidden');
}

UI.btnUndo.addEventListener('click', undo);
UI.btnNext.addEventListener('click', () => {
    if (currentLevelIdx + 1 >= MAX_LEVELS) {
        UI.successOverlay.classList.add('hidden');
        UI.modeOverlay.classList.remove('hidden');
    } else {
        initLevel(currentLevelIdx + 1);
    }
});

function startGame(mode) {
    currentMode = mode;
    UI.modeOverlay.classList.add('hidden');
    AudioController.startMusic();
    initLevel(0);
}

UI.btnEasy.addEventListener('click', () => startGame('easy'));
UI.btnNormal.addEventListener('click', () => startGame('normal'));
UI.btnHard.addEventListener('click', () => startGame('hard'));

if (UI.btnMute) {
    UI.btnMute.addEventListener('click', () => {
        const isMuted = AudioController.toggleMute();
        UI.btnMute.textContent = isMuted ? 'Unmute' : 'Mute';
    });
}

window.addEventListener('message', (e) => {
    if (e.data === 'toggle-lowstim') {
        document.body.classList.toggle('lowstim');
    }
});
