document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const titleScreen = document.getElementById('title-screen');
    const gameContainer = document.getElementById('game-container');
    const winScreen = document.getElementById('win-screen');

    const startBtn = document.getElementById('start-btn');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const targetValueEl = document.getElementById('target-value');
    const numbersGrid = document.getElementById('numbers-grid');
    const expressionDisplay = document.getElementById('expression-display');
    const messageEl = document.getElementById('message');

    const kbdBtns = document.querySelectorAll('.kbd-btn');
    const clearBtn = document.getElementById('clear-btn');
    const backBtn = document.getElementById('back-btn');
    const submitBtn = document.getElementById('submit-btn');

    // Game State
    let target = 0;
    let numbers = [];
    let usedIndices = new Set();
    let expressionTokens = []; // mixed strings: "50", "+", "(", etc.

    const LARGE_NUMBERS = [25, 50, 75, 100];
    const SMALL_NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1);

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

    // Initialization
    function initGame() {
        generateLevel();
        showScreen('game');
    }

    function showScreen(screenName) {
        titleScreen.classList.remove('active');
        gameContainer.classList.add('hidden');
        winScreen.classList.remove('active');

        if (screenName === 'title') {
            titleScreen.classList.add('active');
        } else if (screenName === 'game') {
            gameContainer.classList.remove('hidden');
        } else if (screenName === 'win') {
            winScreen.classList.add('active');
        }
    }

    function generateLevel() {
        target = Math.floor(Math.random() * 899) + 101;
        targetValueEl.textContent = target;

        const large = [...LARGE_NUMBERS].sort(() => 0.5 - Math.random()).slice(0, 2);
        const small = [];
        for (let i = 0; i < 4; i++) {
            small.push(SMALL_NUMBERS[Math.floor(Math.random() * SMALL_NUMBERS.length)]);
        }

        numbers = [...large, ...small];
        resetRound();
    }

    function resetRound() {
        usedIndices.clear();
        expressionTokens = [];
        messageEl.textContent = "";
        updateUI();
    }

    function renderNumbers() {
        numbersGrid.innerHTML = '';
        numbers.forEach((num, index) => {
            const tile = document.createElement('div');
            tile.className = 'num-tile';
            if (usedIndices.has(index)) {
                tile.classList.add('used');
            }
            tile.textContent = num;
            tile.addEventListener('click', () => {
                if (!usedIndices.has(index)) {
                    appendToken(num.toString(), index);
                }
            });
            numbersGrid.appendChild(tile);
        });
    }

    function appendToken(token, index = -1) {
        // Prevent double numbers without operator
        if (expressionTokens.length > 0) {
            const last = expressionTokens[expressionTokens.length - 1];
            const isLastNum = !isNaN(last.token);
            const isCurrNum = !isNaN(token);
            if (isLastNum && isCurrNum) {
                messageEl.textContent = "Need an operator between numbers.";
                return;
            }
        }

        expressionTokens.push({ token, index });
        if (index !== -1) {
            usedIndices.add(index);
        }

        messageEl.textContent = "";
        updateUI();
    }

    function handleBackspace() {
        if (expressionTokens.length === 0) return;

        const last = expressionTokens.pop();
        if (last.index !== -1) {
            usedIndices.delete(last.index);
        }

        messageEl.textContent = "";
        updateUI();
    }

    function updateUI() {
        renderNumbers();

        if (expressionTokens.length === 0) {
            expressionDisplay.innerHTML = '<span class="placeholder">Type or click to build equation...</span>';
            submitBtn.disabled = true;
            backBtn.disabled = true;
        } else {
            // Format expression nicely
            // e.g "25", "+", "50" => "25 + 50"
            let html = "";
            expressionTokens.forEach(tObj => {
                const t = tObj.token;
                if (t === "*" || t === "×") html += " <span style='color:var(--accent-primary)'>×</span> ";
                else if (t === "/" || t === "÷") html += " <span style='color:var(--accent-primary)'>÷</span> ";
                else if (t === "+") html += " <span style='color:var(--accent-primary)'>+</span> ";
                else if (t === "-") html += " <span style='color:var(--accent-primary)'>−</span> ";
                else if (t === "(" || t === ")") html += `<span style='color:var(--accent-gold)'>${t}</span>`;
                else html += t;
            });
            expressionDisplay.innerHTML = html;
            submitBtn.disabled = false;
            backBtn.disabled = false;
        }
    }

    // Safety arithmetic evaluator
    // Evaluates a string tokens array respecting countdown rules
    function evaluateExpression(tokens) {
        // Shunting Yard Algorithm to convert infix to postfix
        const precedence = { '+': 1, '-': 1, '*': 2, '×': 2, '/': 2, '÷': 2 };
        const outputQueue = [];
        const operatorStack = [];

        for (let t of tokens) {
            if (!isNaN(t)) {
                outputQueue.push(parseInt(t, 10));
            } else if (['+', '-', '*', '×', '/', '÷'].includes(t)) {
                while (
                    operatorStack.length > 0 &&
                    operatorStack[operatorStack.length - 1] !== '(' &&
                    precedence[operatorStack[operatorStack.length - 1]] >= precedence[t]
                ) {
                    outputQueue.push(operatorStack.pop());
                }
                operatorStack.push(t);
            } else if (t === '(') {
                operatorStack.push(t);
            } else if (t === ')') {
                let found = false;
                while (operatorStack.length > 0) {
                    const op = operatorStack.pop();
                    if (op === '(') {
                        found = true;
                        break;
                    }
                    outputQueue.push(op);
                }
                if (!found) return { err: "Mismatched parentheses" };
            }
        }

        while (operatorStack.length > 0) {
            const op = operatorStack.pop();
            if (op === '(' || op === ')') return { err: "Mismatched parentheses" };
            outputQueue.push(op);
        }

        // Postfix evaluation tracking intermediate rules
        const evalStack = [];
        for (let token of outputQueue) {
            if (typeof token === 'number') {
                evalStack.push(token);
            } else {
                if (evalStack.length < 2) return { err: "Invalid expression syntax" };
                const b = evalStack.pop();
                const a = evalStack.pop();
                let res = 0;

                if (token === '+') {
                    res = a + b;
                } else if (token === '-') {
                    res = a - b;
                    if (res <= 0) return { err: "Intermediate values must be positive" };
                } else if (token === '*' || token === '×') {
                    res = a * b;
                } else if (token === '/' || token === '÷') {
                    if (b === 0 || a % b !== 0) return { err: "Division must not have a remainder" };
                    res = a / b;
                }
                evalStack.push(res);
            }
        }

        if (evalStack.length !== 1) return { err: "Incomplete expression" };
        return { val: evalStack[0] };
    }

    function handleSubmit() {
        if (expressionTokens.length === 0) return;

        const rawTokens = expressionTokens.map(t => t.token);
        const result = evaluateExpression(rawTokens);
        if (result.err) {
            messageEl.textContent = result.err;
            // shake animation
            expressionDisplay.style.transform = "translateX(-5px)";
            setTimeout(() => expressionDisplay.style.transform = "translateX(5px)", 50);
            setTimeout(() => expressionDisplay.style.transform = "translateX(-5px)", 100);
            setTimeout(() => expressionDisplay.style.transform = "translateX(0)", 150);
            return;
        }

        const finalValue = result.val;
        const exact = finalValue === target;
        const diff = Math.abs(target - finalValue);

        const winHeading = document.getElementById('win-heading');
        const winMessage = document.getElementById('win-message');

        if (exact) {
            winHeading.textContent = "Target Reached!";
            winHeading.style.color = "var(--accent-secondary)";
            winMessage.textContent = `Excellent mental calculation. Spot on!`;
        } else {
            winHeading.textContent = "Round Finished";
            winHeading.style.color = "var(--accent-primary)";
            winMessage.textContent = `You were ${diff} away. (Target: ${target}, You got: ${finalValue})`;
        }

        showScreen('win');
    }

    // Event Listeners
    startBtn.addEventListener('click', () => {
        AudioController.startMusic();
        initGame();
    });
    nextLevelBtn.addEventListener('click', initGame);
    clearBtn.addEventListener('click', resetRound);
    backBtn.addEventListener('click', handleBackspace);
    submitBtn.addEventListener('click', handleSubmit);

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other clicks
            const isMuted = AudioController.toggleMute();
            e.target.textContent = isMuted ? 'Unmute' : 'Mute';
        });
    }

    kbdBtns.forEach(btn => {
        btn.addEventListener('click', () => appendToken(btn.dataset.val));
    });

    // Keyboard support
    window.addEventListener('keydown', (e) => {
        if (gameContainer.classList.contains('hidden')) return;

        const key = e.key;
        if (['+', '-', '*', '/'].includes(key)) {
            appendToken(key);
        } else if (key === '(' || key === ')') {
            appendToken(key);
        } else if (key === 'Enter') {
            if (!submitBtn.disabled) handleSubmit();
        } else if (key === 'Backspace' || key === 'Delete') {
            handleBackspace();
        } else if (key === 'Escape') {
            resetRound();
        } else if (!isNaN(key) && key !== ' ') {
            // Typing actual numbers instead of clicking tiles is tricky because of availability.
            // If they press a digit, look for an available tile with that digit or ending in that digit
            // For true simplicity and to prevent cheating, we only allow clicking tiles or typing ops.
        }
    });

});
