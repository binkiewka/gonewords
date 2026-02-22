// Game State and Settings
let config = {
    gardenProgress: true,
    breathLock: false,
    difficulty: 'easy'
};

const UI = {
    menuBtn: document.getElementById('btn-menu'),
    audioBtn: document.getElementById('btn-audio'),
    audioIconOn: document.getElementById('icon-audio-on'),
    audioIconOff: document.getElementById('icon-audio-off'),
    gameHeader: document.getElementById('game-header'),
    gameArea: document.getElementById('game-area'),
    introOverlay: document.getElementById('intro-overlay'),
    successOverlay: document.getElementById('success-overlay'),
    finalStats: document.getElementById('final-stats'),

    // Twist Toggles
    toggleGarden: document.getElementById('btn-twist-garden'),
    toggleBreath: document.getElementById('btn-twist-breath'),
    diffBtns: document.querySelectorAll('.diff-btn'),
    startBtn: document.getElementById('btn-start'),
    nextBtn: document.getElementById('btn-next'),

    // Gameplay UI
    board: document.getElementById('sudoku-board'),
    btnUndo: document.getElementById('btn-undo'),
    btnErase: document.getElementById('btn-erase'),
    btnNotes: document.getElementById('btn-notes'),
    btnHint: document.getElementById('btn-hint'),
    numpadBtns: document.querySelectorAll('.numpad-btn'),

    // Twists
    gardenStrip: document.getElementById('garden-strip'),
    breathRingContainer: document.getElementById('breath-ring-container')
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

        this.audioElement = document.getElementById('bg-music') || new Audio();
        this.audioElement.loop = false;
        this.audioElement.volume = 0.3;

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
        if (this.audioElement.paused && !this.isMuted) {
            this.audioElement.src = this.tracks[this.currentTrackIdx];
            this.audioElement.play().catch(e => console.log("Audio play failed:", e));
        }
    }
};

// ── Intro / Overlay Logic ───────────────────────

UI.diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Only toggle difficulty buttons, ignore twists
        if (btn.id === 'btn-twist-garden' || btn.id === 'btn-twist-breath') return;

        UI.diffBtns.forEach(b => {
            if (b.id !== 'btn-twist-garden' && b.id !== 'btn-twist-breath') {
                b.classList.remove('active')
            }
        });
        btn.classList.add('active');
        config.difficulty = btn.dataset.diff;
    });
});

UI.toggleGarden.addEventListener('click', () => {
    UI.toggleGarden.classList.toggle('active');
});

UI.toggleBreath.addEventListener('click', () => {
    UI.toggleBreath.classList.toggle('active');
});

UI.audioBtn.addEventListener('click', () => {
    AudioController.isMuted = !AudioController.isMuted;
    if (AudioController.audioElement) {
        AudioController.audioElement.muted = AudioController.isMuted;
        if (!AudioController.isMuted && AudioController.audioElement.paused) {
            AudioController.audioElement.play().catch(e => console.log("Audio resume failed:", e));
        }
    }

    if (AudioController.isMuted) {
        UI.audioIconOn.classList.add('hidden');
        UI.audioIconOff.classList.remove('hidden');
    } else {
        UI.audioIconOn.classList.remove('hidden');
        UI.audioIconOff.classList.add('hidden');
    }
});

UI.startBtn.addEventListener('click', () => {
    config.gardenProgress = UI.toggleGarden.classList.contains('active');
    config.breathLock = UI.toggleBreath.classList.contains('active');

    UI.introOverlay.classList.add('hidden');
    UI.gameHeader.classList.remove('hidden');
    UI.gameArea.classList.remove('hidden');

    UI.gardenStrip.classList.toggle('hidden', !config.gardenProgress);
    UI.breathRingContainer.classList.toggle('hidden', !config.breathLock);

    AudioController.startMusic();
    startNewGame();
});

UI.nextBtn.addEventListener('click', () => {
    UI.successOverlay.classList.add('hidden');
    startNewGame();
});

UI.menuBtn.addEventListener('click', () => {
    UI.gameHeader.classList.add('hidden');
    UI.gameArea.classList.add('hidden');
    UI.introOverlay.classList.remove('hidden');
});

// ── Sudoku Core Engine ───────────────────────

let puzzle = [];
// 9x9 array. Cell: { r, c, val: 0, type: 'empty' | 'given' | 'user', notes: Set, domElement: el }

let solution = []; // 9x9 int grid
let history = [];
let selectedCell = null; // {r, c}
let notesMode = false;
let isGameFinished = false;

function startNewGame() {
    isGameFinished = false;
    history = [];
    selectedCell = null;
    notesMode = false;
    updateNotesBtnUI();
    updateUndoBtnUI();

    // Clear twists data
    resetGardenState();
    resetBreathState();

    generateProceduralSudoku();
    renderBoard();
}

function generateProceduralSudoku() {
    // 1. Create empty board
    let tempBoard = Array(9).fill().map(() => Array(9).fill(0));

    // 2. Fill diagonal 3x3s to add randomness efficiently
    fillBox(tempBoard, 0, 0);
    fillBox(tempBoard, 3, 3);
    fillBox(tempBoard, 6, 6);

    // 3. Solve the rest to get a complete valid board
    solveBoard(tempBoard);
    solution = tempBoard.map(row => [...row]);

    // 4. Remove elements based on difficulty
    let targetGivens = 40; // easy
    if (config.difficulty === 'medium') targetGivens = 32;
    if (config.difficulty === 'hard') targetGivens = 26;

    let cellsToHide = 81 - targetGivens;
    let positions = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            positions.push({ r, c });
        }
    }
    // shuffle
    positions.sort(() => Math.random() - 0.5);

    // Map to our real puzzle data structure
    puzzle = Array(9).fill().map((_, r) => Array(9).fill().map((_, c) => ({
        r, c,
        val: tempBoard[r][c],
        type: 'given',
        notes: new Set(),
        domElement: null
    })));

    // Basic removal (not guaranteeing unique solution for MVP but good enough for fast generation)
    // To be perfectly unique, we would need to run the solver and count solutions, but this is an MVP.
    for (let i = 0; i < cellsToHide; i++) {
        let pos = positions[i];
        puzzle[pos.r][pos.c].val = 0;
        puzzle[pos.r][pos.c].type = 'empty';
    }
}

// Helper: fill 3x3 box
function fillBox(board, rowStart, colStart) {
    let num = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    num.sort(() => Math.random() - 0.5);
    let i = 0;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            board[rowStart + r][colStart + c] = num[i++];
        }
    }
}

// Basic solver
function solveBoard(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                for (let v = 1; v <= 9; v++) {
                    if (isValidPlacement(board, r, c, v)) {
                        board[r][c] = v;
                        if (solveBoard(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function isValidPlacement(board, r, c, val) {
    // row/col map checks
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === val) return false;
        if (board[i][c] === val) return false;
    }
    // 3x3 box check
    let startRow = r - r % 3;
    let startCol = c - c % 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[i + startRow][j + startCol] === val) return false;
        }
    }
    return true;
}

// ── Rendering & Interaction ───────────────────────

function renderBoard() {
    UI.board.innerHTML = '';

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            let cellData = puzzle[r][c];

            const cellEl = document.createElement('div');
            cellEl.className = 'sudoku-cell';

            if (cellData.type === 'given') {
                cellEl.classList.add('given');
                cellEl.textContent = cellData.val;
            } else {
                updateCellDisplay(cellData, cellEl);
            }

            // Interaction
            cellEl.addEventListener('click', () => selectCell(r, c));
            cellData.domElement = cellEl;

            UI.board.appendChild(cellEl);
        }
    }
    validateConflictsUI(); // Initial check
}

function updateCellDisplay(cellData, el) {
    el.innerHTML = ''; // clear notes or text

    if (cellData.val !== 0) {
        el.textContent = cellData.val;
        // style for user entry
        if (cellData.type === 'user') el.style.color = "var(--color-text-entry)";
    } else if (cellData.notes.size > 0) {
        // Create notes grid
        const notesGrid = document.createElement('div');
        notesGrid.className = 'cell-notes';
        for (let n = 1; n <= 9; n++) {
            const span = document.createElement('span');
            span.className = 'note-num';
            if (cellData.notes.has(n)) {
                span.textContent = n;
            }
            notesGrid.appendChild(span);
        }
        el.appendChild(notesGrid);
    }
}

function selectCell(r, c) {
    if (isGameFinished) return;

    // Unselect old
    puzzle.flat().forEach(cell => {
        if (cell.domElement) {
            cell.domElement.classList.remove('selected', 'highlighted');
        }
    });

    selectedCell = { r, c };
    let data = puzzle[r][c];

    data.domElement.classList.add('selected');

    // Highlight same row, col, box, and same number
    let valToHighlight = data.val;
    for (let ir = 0; ir < 9; ir++) {
        for (let ic = 0; ic < 9; ic++) {
            let isSameBox = (Math.floor(ir / 3) === Math.floor(r / 3) && Math.floor(ic / 3) === Math.floor(c / 3));
            if (ir === r || ic === c || isSameBox) {
                if (ir !== r || ic !== c) {
                    puzzle[ir][ic].domElement.classList.add('highlighted');
                }
            }
            // Highlight same number globally
            if (valToHighlight !== 0 && puzzle[ir][ic].val === valToHighlight && (ir !== r || ic !== c)) {
                puzzle[ir][ic].domElement.classList.add('highlighted');
            }
        }
    }
}

// ── Gameplay Inputs ───────────────────────

UI.numpadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        handlePlayerInput(parseInt(btn.dataset.val));
    });
});

UI.btnErase.addEventListener('click', () => handlePlayerInput(0));

UI.btnNotes.addEventListener('click', () => {
    notesMode = !notesMode;
    updateNotesBtnUI();
});

function updateNotesBtnUI() {
    UI.btnNotes.textContent = notesMode ? "Notes: On" : "Notes: Off";
    if (notesMode) UI.btnNotes.classList.add('active');
    else UI.btnNotes.classList.remove('active');
}

function handlePlayerInput(val) {
    if (isGameFinished || !selectedCell) return;

    let cellData = puzzle[selectedCell.r][selectedCell.c];
    if (cellData.type === 'given') return; // Cannot modify givens

    // Twist 1 check: Breath-lock
    if (config.breathLock && breathPhase !== 'exhale' && val !== 0 && !notesMode) {
        // Visual shake 
        UI.breathRingContainer.style.transform = 'translateX(5px)';
        setTimeout(() => UI.breathRingContainer.style.transform = 'translateX(-5px)', 50);
        setTimeout(() => UI.breathRingContainer.style.transform = 'translateX(5px)', 100);
        setTimeout(() => UI.breathRingContainer.style.transform = 'translateX(0)', 150);
        return;
    }

    // Generate history snapshot
    let snapshot = {
        r: selectedCell.r,
        c: selectedCell.c,
        prevVal: cellData.val,
        prevType: cellData.type,
        prevNotes: new Set(cellData.notes), // copy
    };

    let didChange = false;

    if (val === 0) { // Erase
        if (cellData.val !== 0) {
            cellData.val = 0;
            cellData.type = 'empty';
            didChange = true;
        } else if (cellData.notes.size > 0) {
            cellData.notes.clear();
            didChange = true;
        }
    } else {
        if (notesMode) {
            if (cellData.val !== 0) return; // Can't add notes on filled cell

            if (cellData.notes.has(val)) cellData.notes.delete(val);
            else cellData.notes.add(val);
            didChange = true;
        } else {
            if (cellData.val !== val) {
                cellData.val = val;
                cellData.type = 'user';
                didChange = true;
            }
        }
    }

    if (didChange) {
        history.push(snapshot);
        updateUndoBtnUI();
        updateCellDisplay(cellData, cellData.domElement);
        validateConflictsUI();

        // Reselect to update highlighting (like same numbers)
        selectCell(selectedCell.r, selectedCell.c);

        // Check Garden Progress twists if in normal entry
        if (val !== 0 && !notesMode) {
            checkGardenProgressTwist();
            checkWinCondition();
        }
    }
}

UI.btnUndo.addEventListener('click', () => {
    if (isGameFinished || history.length === 0) return;

    let snapshot = history.pop();
    let cellData = puzzle[snapshot.r][snapshot.c];

    cellData.val = snapshot.prevVal;
    cellData.type = snapshot.prevType;
    cellData.notes = new Set(snapshot.prevNotes);

    updateCellDisplay(cellData, cellData.domElement);
    validateConflictsUI();
    selectCell(snapshot.r, snapshot.c);
    updateUndoBtnUI();
});

function updateUndoBtnUI() {
    UI.btnUndo.style.opacity = history.length > 0 ? "1" : "0.5";
    UI.btnUndo.style.cursor = history.length > 0 ? "pointer" : "default";
}

// ── Validation & Win Checks ───────────────────────

function getConflicts() {
    let conflicts = Array(9).fill().map(() => Array(9).fill(false));

    // Check rows
    for (let r = 0; r < 9; r++) {
        let seen = new Map();
        for (let c = 0; c < 9; c++) {
            let val = puzzle[r][c].val;
            if (val === 0) continue;
            if (seen.has(val)) {
                conflicts[r][c] = true;
                conflicts[r][seen.get(val)] = true;
            } else {
                seen.set(val, c);
            }
        }
    }
    // Check cols
    for (let c = 0; c < 9; c++) {
        let seen = new Map();
        for (let r = 0; r < 9; r++) {
            let val = puzzle[r][c].val;
            if (val === 0) continue;
            if (seen.has(val)) {
                conflicts[r][c] = true;
                conflicts[seen.get(val)][c] = true;
            } else {
                seen.set(val, r);
            }
        }
    }
    // Check boxes
    for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
            let seen = new Map();
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let r = br * 3 + i;
                    let c = bc * 3 + j;
                    let val = puzzle[r][c].val;
                    if (val === 0) continue;
                    if (seen.has(val)) {
                        conflicts[r][c] = true;
                        let origin = seen.get(val);
                        conflicts[origin.r][origin.c] = true;
                    } else {
                        seen.set(val, { r, c });
                    }
                }
            }
        }
    }
    return conflicts;
}

function validateConflictsUI() {
    let conflicts = getConflicts();
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (conflicts[r][c]) {
                if (puzzle[r][c].domElement) puzzle[r][c].domElement.classList.add('conflict');
            } else {
                if (puzzle[r][c].domElement) puzzle[r][c].domElement.classList.remove('conflict');
            }
        }
    }
}

function checkWinCondition() {
    let hasZero = false;
    let conflicts = getConflicts();
    let hasConflict = false;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (puzzle[r][c].val === 0) hasZero = true;
            if (conflicts[r][c]) hasConflict = true;
        }
    }

    if (!hasZero && !hasConflict) {
        triggerWin();
    }
}

function triggerWin() {
    if (isGameFinished) return;
    isGameFinished = true;
    setTimeout(() => {
        UI.successOverlay.classList.remove('hidden');
    }, 1000);
}

// ── Twists Logic ───────────────────────

UI.btnHint.addEventListener('click', () => {
    // Fill selected cell with correct solution if valid
    if (isGameFinished || !selectedCell) return;
    let cellData = puzzle[selectedCell.r][selectedCell.c];
    if (cellData.type === 'given') return;

    let correctVal = solution[selectedCell.r][selectedCell.c];

    let snapshot = {
        r: selectedCell.r,
        c: selectedCell.c,
        prevVal: cellData.val,
        prevType: cellData.type,
        prevNotes: new Set(cellData.notes),
    };

    cellData.val = correctVal;
    cellData.type = 'user';
    cellData.notes.clear();

    history.push(snapshot);
    updateUndoBtnUI();
    updateCellDisplay(cellData, cellData.domElement);
    validateConflictsUI();
    selectCell(selectedCell.r, selectedCell.c);
    checkGardenProgressTwist();
    checkWinCondition();
});

// Twist: Garden Progress
let gardenState = { rows: [], cols: [], boxes: [] };

function resetGardenState() {
    gardenState = {
        rows: Array(9).fill(false),
        cols: Array(9).fill(false),
        boxes: Array(9).fill(false)
    };
    UI.gardenStrip.innerHTML = '';
}

function checkGardenProgressTwist() {
    if (!config.gardenProgress) return;
    let conflicts = getConflicts();

    // Check Rows
    for (let r = 0; r < 9; r++) {
        if (!gardenState.rows[r]) {
            let complete = true;
            for (let c = 0; c < 9; c++) {
                if (puzzle[r][c].val === 0 || conflicts[r][c]) complete = false;
            }
            if (complete) {
                gardenState.rows[r] = true;
                spawnGardenItem('🌿', 'grass');
            }
        }
    }
    // Check Cols
    for (let c = 0; c < 9; c++) {
        if (!gardenState.cols[c]) {
            let complete = true;
            for (let r = 0; r < 9; r++) {
                if (puzzle[r][c].val === 0 || conflicts[r][c]) complete = false;
            }
            if (complete) {
                gardenState.cols[c] = true;
                spawnGardenItem('🪴', 'bush');
            }
        }
    }
    // Check Boxes
    for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
            let boxIdx = br * 3 + bc;
            if (!gardenState.boxes[boxIdx]) {
                let complete = true;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        let r = br * 3 + i;
                        let c = bc * 3 + j;
                        if (puzzle[r][c].val === 0 || conflicts[r][c]) complete = false;
                    }
                }
                if (complete) {
                    gardenState.boxes[boxIdx] = true;
                    spawnGardenItem('🌸', 'flower');
                }
            }
        }
    }
}

function spawnGardenItem(emoji, className) {
    const el = document.createElement('div');
    el.className = `garden-item ${className}`;
    el.textContent = emoji;
    UI.gardenStrip.appendChild(el);

    // Small animation
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all 0.5s ease-out';
    el.style.fontSize = '1.8rem';

    setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 50);
}

// Twist: Breath-Lock
let breathPhase = 'inhale'; // inhale, hold1, exhale, hold2
let breathTimer = 0;
const BREATH_DURATION = 4000; // 4s per phase
let breathReq = null;
let lastTime = 0;

const breathRing = document.querySelector('.breath-indicator');
const breathLabel = document.querySelector('.breath-label');

function resetBreathState() {
    if (breathReq) cancelAnimationFrame(breathReq);
    breathPhase = 'inhale';
    breathTimer = 0;
    lastTime = performance.now();
    if (config.breathLock) {
        breathReq = requestAnimationFrame(breathLoop);
    }
}

function breathLoop(time) {
    if (!lastTime) lastTime = time;
    let dt = time - lastTime;
    lastTime = time;
    breathTimer += dt;

    if (breathTimer > BREATH_DURATION) {
        breathTimer -= BREATH_DURATION;
        if (breathPhase === 'inhale') breathPhase = 'hold1';
        else if (breathPhase === 'hold1') breathPhase = 'exhale';
        else if (breathPhase === 'exhale') breathPhase = 'hold2';
        else if (breathPhase === 'hold2') breathPhase = 'inhale';
    }

    let progress = breathTimer / BREATH_DURATION;

    if (breathPhase === 'inhale') {
        let scale = 0.4 + 0.6 * (Math.sin((progress * Math.PI) - Math.PI / 2) * 0.5 + 0.5); // 0.4 to 1.0
        if (breathRing) breathRing.style.transform = `scale(${scale})`;
        if (breathLabel) breathLabel.textContent = "Inhale...";
    } else if (breathPhase === 'hold1') {
        if (breathRing) breathRing.style.transform = `scale(1)`;
        if (breathLabel) breathLabel.textContent = "Hold";
    } else if (breathPhase === 'exhale') {
        let scale = 1.0 - 0.6 * (Math.sin((progress * Math.PI) - Math.PI / 2) * 0.5 + 0.5); // 1.0 to 0.4
        if (breathRing) breathRing.style.transform = `scale(${scale})`;
        if (breathLabel) breathLabel.textContent = "Exhale (Play)";
    } else if (breathPhase === 'hold2') {
        if (breathRing) breathRing.style.transform = `scale(0.4)`;
        if (breathLabel) breathLabel.textContent = "Hold";
    }

    if (config.breathLock) {
        breathReq = requestAnimationFrame(breathLoop);
    }
}
