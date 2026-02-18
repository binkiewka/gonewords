const gridSize = 10;
let grid = [];
let words = [];
let selectedCells = [];
let foundWords = [];
let isSelecting = false;

let anchorCell = null;

const gridContainer = document.getElementById('grid');
const wordListContainer = document.getElementById('word-list');
const messageElement = document.getElementById('message');

function initGame() {
    console.log('Initializing game...');
    // Select 6 random words
    const shuffledWords = [...WORD_LIBRARY].sort(() => 0.5 - Math.random());
    words = shuffledWords.slice(0, 6);

    grid = Array(gridSize).fill().map(() => Array(gridSize).fill(''));
    foundWords = [];
    selectedCells = [];
    anchorCell = null;

    placeWords();
    fillEmptyCells();
    renderGrid();
    renderWordList();
    messageElement.textContent = 'Drag or tap first and last letters to select.';

    // Start audio on first interaction if not already started
    if (!AudioController.isInitialized) {
        document.body.addEventListener('click', () => AudioController.startMusic(), { once: true });
        document.body.addEventListener('touchstart', () => AudioController.startMusic(), { once: true });
    }
}

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

document.getElementById('mute-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering other clicks
    const isMuted = AudioController.toggleMute();
    e.target.textContent = isMuted ? 'Unmute' : 'Mute';
});

function placeWords() {
    for (const word of words) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 100) {
            const direction = Math.floor(Math.random() * 3); // 0: horizontal, 1: vertical, 2: diagonal
            const row = Math.floor(Math.random() * gridSize);
            const col = Math.floor(Math.random() * gridSize);

            if (canPlaceWord(word, row, col, direction)) {
                for (let i = 0; i < word.length; i++) {
                    let r = row, c = col;
                    if (direction === 0) c += i;
                    else if (direction === 1) r += i;
                    else {
                        r += i;
                        c += i;
                    }
                    grid[r][c] = word[i];
                }
                placed = true;
            }
            attempts++;
        }
    }
}

function canPlaceWord(word, row, col, direction) {
    if (direction === 0 && col + word.length > gridSize) return false;
    if (direction === 1 && row + word.length > gridSize) return false;
    if (direction === 2 && (row + word.length > gridSize || col + word.length > gridSize)) return false;

    for (let i = 0; i < word.length; i++) {
        let r = row, c = col;
        if (direction === 0) c += i;
        else if (direction === 1) r += i;
        else {
            r += i;
            c += i;
        }

        if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
    }
    return true;
}

function fillEmptyCells() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
            }
        }
    }
}

function renderGrid() {
    gridContainer.innerHTML = '';
    gridContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = grid[r][c];
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Mouse events
            cell.addEventListener('mousedown', startSelection);
            cell.addEventListener('mouseenter', continueSelection);
            cell.addEventListener('mouseup', endSelection);

            // Touch events
            // Touch events
            cell.addEventListener('touchstart', (e) => {
                startSelection(e);
            }, {
                passive: false
            });

            gridContainer.appendChild(cell);
        }
    }

    // Global event listeners for ending selection outside grid
    document.addEventListener('mouseup', endSelection);
    gridContainer.addEventListener('touchmove', handleTouchMove, {
        passive: false
    });
    document.addEventListener('touchend', endSelection);
}

function renderWordList() {
    wordListContainer.innerHTML = '';
    words.forEach(word => {
        const el = document.createElement('div');
        el.className = 'word-item';
        if (foundWords.includes(word)) el.classList.add('found');
        el.textContent = word;
        el.dataset.word = word;
        el.addEventListener('click', () => {
            if (!foundWords.includes(word)) {
                messageElement.textContent = `Find "${word}" in the grid!`;
                // Reset animation
                messageElement.style.animation = 'none';
                el.offsetHeight; /* trigger reflow */
                messageElement.style.animation = 'pop 0.3s ease';
            }
        });
        wordListContainer.appendChild(el);
    });
}

function getCellAt(row, col) {
    return gridContainer.children[row * gridSize + col];
}

// Debounce for touch/mouse hybrid devices
let lastInteractionTime = 0;

function startSelection(e) {
    const now = Date.now();
    if (now - lastInteractionTime < 300) return; // Ignore events within 300ms of each other
    lastInteractionTime = now;

    const cell = getTargetCell(e);
    if (!cell) return;

    // Prevent default to stop text selection/simulated clicks
    if (e.cancelable) e.preventDefault();

    // If we have an anchor and click a distinct second cell, try to complete selection
    if (anchorCell && anchorCell !== cell && !isSelecting) {
        const lineCells = getLineCells(anchorCell, cell);
        if (lineCells) {
            clearSelection();
            lineCells.forEach(c => selectCell(c));
            checkWord();
            anchorCell = null;
            return;
        }
    }

    // Otherwise start a new drag or anchor selection
    isSelecting = true;
    clearSelection();
    anchorCell = null; // Clear previous anchor if starting new drag
    selectCell(cell);
}

function continueSelection(e) {
    if (!isSelecting) return;
    const cell = getTargetCell(e);
    if (cell && !selectedCells.includes(cell)) {
        selectCell(cell);
    }
}

function handleTouchMove(e) {
    if (!isSelecting) return;
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('cell')) {
        if (!selectedCells.includes(target)) {
            selectCell(target);
        }
    }
}

function getTargetCell(e) {
    let target = e.target;
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY);
    }
    if (target && target.classList.contains('cell')) return target;
    return null;
}

function selectCell(cell) {
    if (!selectedCells.includes(cell)) {
        selectedCells.push(cell);
        cell.classList.add('selected');
    }
}

function clearSelection() {
    selectedCells.forEach(c => c.classList.remove('selected'));
    selectedCells = [];
    document.querySelectorAll('.cell.active-anchor').forEach(c => c.classList.remove('active-anchor'));
}

function endSelection(e) {
    if (!isSelecting) return;
    isSelecting = false;

    // If we only selected one cell, treat it as an anchor
    if (selectedCells.length === 1) {
        const cell = selectedCells[0];
        anchorCell = cell;
        cell.classList.add('active-anchor');
        return;
    }

    checkWord();
    clearSelection();
}

function getLineCells(startCell, endCell) {
    const r1 = parseInt(startCell.dataset.row);
    const c1 = parseInt(startCell.dataset.col);
    const r2 = parseInt(endCell.dataset.row);
    const c2 = parseInt(endCell.dataset.col);

    const dr = r2 - r1;
    const dc = c2 - c1;

    // Check if horizontal, vertical, or diagonal
    if (r1 !== r2 && c1 !== c2 && Math.abs(dr) !== Math.abs(dc)) return null;

    const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
    const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

    const cells = [];
    let r = r1,
        c = c1;

    while (true) {
        const cell = getCellAt(r, c);
        if (cell) cells.push(cell);

        if (r === r2 && c === c2) break;

        r += stepR;
        c += stepC;

        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) break;
    }
    return cells;
}

function checkWord() {
    const selectedWord = selectedCells.map(c => c.textContent).join('');
    const reverseWord = selectedWord.split('').reverse().join('');

    if (words.includes(selectedWord) && !foundWords.includes(selectedWord)) {
        markFound(selectedWord);
    } else if (words.includes(reverseWord) && !foundWords.includes(reverseWord)) {
        markFound(reverseWord);
    }
}

function markFound(word) {
    foundWords.push(word);
    renderWordList();

    // Mark cells permanently
    selectedCells.forEach(cell => {
        cell.classList.add('found');
        // Remove transient selected class so it doesn't get cleared
        cell.classList.remove('selected');
    });

    if (foundWords.length === words.length) {
        messageElement.textContent = "All words found. Well done.";
        setTimeout(() => initGame(), 3000);
    }
}

document.getElementById('new-game-btn').addEventListener('click', initGame);

// Start
initGame();
