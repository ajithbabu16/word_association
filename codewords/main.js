/**
 * Main Application Controller
 */

class CodewordsGame {
    constructor() {
        this.logic = new CodewordsLogic();
        this.solver = new CodewordsSolver(this);
        this.levels = {};
        this.currentLevelId = "1";
        this.levelIds = [];
        this.reportServiceUrl = window.location.origin;
        this.duplicateServiceUrl = window.location.origin;
        this.stats = { pass: 0, fail: 0, levels: [] };
        this.resultsChart = null;

        this.init();
    }

    init() {
        // Menu Navigation
        const showAutoBtn = document.getElementById('show-automation-btn');
        const mainMenu = document.getElementById('main-menu');
        const autoSetup = document.getElementById('automation-setup');

        // Cancel Button (New)
        const cancelAutoBtn = document.getElementById('cancel-automation-btn');

        if (showAutoBtn && mainMenu && autoSetup) {
            showAutoBtn.addEventListener('click', async () => {
                console.log("Navigating to Automation Setup (v21)...");

                // Fetch and populate existing reports dropdown
                await this.fetchExistingReports();

                // Explicitly sync visibility of containers based on current radio state
                const currentMode = document.querySelector('input[name="report-mode"]:checked')?.value || 'new';
                const newContainer = document.getElementById('new-report-name-container');
                const existingContainer = document.getElementById('existing-reports-container');

                if (currentMode === 'new') {
                    if (newContainer) newContainer.style.display = 'block';
                    if (existingContainer) existingContainer.style.display = 'none';
                } else {
                    if (newContainer) newContainer.style.display = 'none';
                    if (existingContainer) existingContainer.style.display = 'block';
                }

                mainMenu.classList.add('hidden');
                autoSetup.classList.remove('hidden');
                autoSetup.classList.add('fade-in');
                // Ensure defaults are populated 
                if (!this.automationInitialized) {
                    this.initAutomationDefaults();
                    this.automationInitialized = true;
                }
            });
        }

        if (cancelAutoBtn) {
            cancelAutoBtn.addEventListener('click', () => {
                console.log("Returning to Main Menu...");
                autoSetup.classList.add('hidden');
                mainMenu.classList.remove('hidden');
                mainMenu.classList.add('fade-in');
            });
        }

        // --- NEW: Comparison Screen Navigation ---
        const showCompBtn = document.getElementById('show-comparison-btn');
        const compSetup = document.getElementById('comparison-setup');
        const cancelCompBtn = document.getElementById('cancel-comparison-btn');

        if (showCompBtn && compSetup) {
            showCompBtn.addEventListener('click', () => {
                mainMenu.classList.add('hidden');
                compSetup.classList.remove('hidden');
                compSetup.classList.add('fade-in');
            });
        }

        if (cancelCompBtn) {
            cancelCompBtn.addEventListener('click', () => {
                compSetup.classList.add('hidden');
                mainMenu.classList.remove('hidden');
                mainMenu.classList.add('fade-in');
                // Optional: Clear results state?
            });
        }

        // Initialize Comparison Controls
        this.setupComparisonControls();

        // --- NEW: CSV Comparison Screen Navigation ---
        const showCsvCompBtn = document.getElementById('show-csv-comparison-btn');
        const csvCompSetup = document.getElementById('csv-comparison-setup');
        const cancelCsvCompBtn = document.getElementById('cancel-csv-comparison-btn');

        if (showCsvCompBtn && csvCompSetup) {
            showCsvCompBtn.addEventListener('click', () => {
                mainMenu.classList.add('hidden');
                csvCompSetup.classList.remove('hidden');
                csvCompSetup.classList.add('fade-in');
            });
        }

        if (cancelCsvCompBtn) {
            cancelCsvCompBtn.addEventListener('click', () => {
                csvCompSetup.classList.add('hidden');
                mainMenu.classList.remove('hidden');
                mainMenu.classList.add('fade-in');
            });
        }

        this.setupCsvComparisonControls();

        // --- NEW: Phrase Check Screen Navigation ---
        const showPhraseBtn = document.getElementById('show-phrase-check-btn');
        const phraseSetup = document.getElementById('phrase-check-setup');
        const cancelPhraseBtn = document.getElementById('cancel-phrase-check-btn');

        if (showPhraseBtn && phraseSetup) {
            showPhraseBtn.addEventListener('click', () => {
                mainMenu.classList.add('hidden');
                phraseSetup.classList.remove('hidden');
                phraseSetup.classList.add('fade-in');
            });
        }

        if (cancelPhraseBtn) {
            cancelPhraseBtn.addEventListener('click', () => {
                phraseSetup.classList.add('hidden');
                mainMenu.classList.remove('hidden');
                mainMenu.classList.add('fade-in');
            });
        }

        this.setupPhraseCheckControls();

        // --- NEW: Duplication Check Screen Navigation ---
        const showDupBtn = document.getElementById('show-duplicate-btn');
        const dupSetup = document.getElementById('duplicate-check-setup');
        const cancelDupBtn = document.getElementById('cancel-duplicate-btn');

        if (showDupBtn && dupSetup) {
            showDupBtn.addEventListener('click', () => {
                mainMenu.classList.add('hidden');
                dupSetup.classList.remove('hidden');
                dupSetup.classList.add('fade-in');
            });
        }

        if (cancelDupBtn) {
            cancelDupBtn.addEventListener('click', () => {
                dupSetup.classList.add('hidden');
                mainMenu.classList.remove('hidden');
                mainMenu.classList.add('fade-in');
            });
        }

        this.setupDuplicateControls();

        // --- NEW: Memory Check Screen Redirection ---
        const showMemoryBtn = document.getElementById('show-memory-check-btn');

        if (showMemoryBtn) {
            showMemoryBtn.addEventListener('click', () => {
                window.location.href = 'memory_check.html';
            });
        }

        // Initialize Automation UI Controls
        this.setupAutomationControls();

        // Start Automation
        const startBtn = document.getElementById('start-automation-btn');
        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                if (!this.levelIds || this.levelIds.length === 0) {
                    alert("Please upload a JSON file before starting automation.");
                    return;
                }

                const config = this.getAutomationConfig();
                console.log("Start Button Clicked. Config:", config);

                if (!config.reportMode) {
                    const modeContainer = document.querySelector('.report-mode-options');
                    if (modeContainer) {
                        modeContainer.classList.add('error-pulse');
                        setTimeout(() => modeContainer.classList.remove('error-pulse'), 2000);
                    }
                    alert("Please select Validation Report Mode! (New, Reset or Continue) - This is mandatory.");
                    return;
                }

                if (!config.reportName) {
                    const mode = config.reportMode;
                    const targetId = mode === 'new' ? 'report-name' : 'existing-reports';
                    const targetInput = document.getElementById(targetId);

                    if (targetInput) {
                        targetInput.classList.add('error-pulse');
                        setTimeout(() => targetInput.classList.remove('error-pulse'), 2000);
                    }

                    if (mode === 'new') {
                        alert("Please provide a New Report Name!");
                    } else {
                        alert("Please select an existing report from the dropdown!");
                    }
                    return;
                }

                console.log("Configuring Automation:", config);

                // 1. Send Config to Reporter Service
                await this.configureReporter(config);
                this.activeReportName = config.reportName; // Store for live actions

                // 2. Start Game Logic
                const landing = document.getElementById('landing-screen');
                const wrapper = document.getElementById('game-wrapper');

                landing.classList.add('fade-out');
                setTimeout(() => {
                    landing.classList.add('hidden');
                    wrapper.classList.remove('hidden');

                    // Load and Start Auto-Solve
                    const firstId = this.levels[config.startLevel] ? config.startLevel : this.levelIds[0];
                    this.loadLevel(firstId);

                    // Configure Solver with speed
                    if (this.solver) {
                        this.solver.typingSpeed = config.typingSpeed;
                    }

                    setTimeout(() => this.solver.start(), 500);
                }, 800);
            });
        }

        // Event Listeners
        document.getElementById('auto-play-btn').addEventListener('click', () => {
            if (this.solver.isActive) this.solver.stop();
            else this.solver.start();
        });

        document.getElementById('continue-btn').addEventListener('click', () => this.handleContinue());
        document.getElementById('skip-failed-level-btn').addEventListener('click', () => this.handleContinue());

        document.getElementById('jump-btn').addEventListener('click', () => {
            const levelId = document.getElementById('jump-level-input').value.trim();
            if (this.levels[levelId]) {
                if (this.solver.isActive) this.solver.stop();
                this.loadLevel(levelId);
            }
        });

        // --- NEW: Live Report Actions ---
        const liveGraphBtn = document.getElementById('live-graph-btn');
        const liveViewBtn = document.getElementById('live-view-btn');
        const liveDownloadBtn = document.getElementById('live-download-btn');

        if (liveGraphBtn) {
            console.log("Live Graph Button Listener Attached.");
            liveGraphBtn.addEventListener('click', () => {
                console.log("Live Graph Button Clicked!");
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) {
                    const isHidden = statsContainer.classList.toggle('hidden');
                    console.log("Stats Dashboard visibility toggled. Hidden:", isHidden);
                    if (!isHidden) {
                        this.initStatsDashboard(); // Lazy init or update
                    }
                } else {
                    console.error("Critical: 'stats-container' not found in DOM.");
                }
            });
        }

        if (liveViewBtn) {
            liveViewBtn.addEventListener('click', () => {
                if (!this.activeReportName) return alert("No active report session found.");
                window.open(`${this.reportServiceUrl}/view-report?name=${encodeURIComponent(this.activeReportName)}`, '_blank');
            });
        }

        if (liveDownloadBtn) {
            liveDownloadBtn.addEventListener('click', () => {
                if (!this.activeReportName) return alert("No active report session found.");
                window.open(`${this.reportServiceUrl}/download-report?name=${encodeURIComponent(this.activeReportName)}`, '_blank');
            });
        }
    }

    loadLevel(id) {
        const wasActive = this.solver.isActive;
        if (wasActive) this.solver.stop();

        this.currentLevelId = id;
        const levelData = this.levels[id];
        if (!levelData) return;

        // --- NEW: Perform Data Validation ---
        const vErrors = this.logic.validateLevelData(levelData);
        if (vErrors.length > 0) {
            this.showValidationError(vErrors, levelData);
            return;
        } else {
            // Success: Clean up any previous error state
            document.getElementById('validation-overlay').classList.add('hidden');
            document.getElementById('validation-overlay').classList.remove('visible');
        }

        this.logic.initLevel(levelData);
        document.getElementById('current-level-num').innerText = id;
        document.getElementById('quote-text').innerText = (levelData.phrase || "").replace(/_/g, '...');
        document.getElementById('quote-author').innerText = levelData.author || "Unknown";

        this.renderBoard();
        this.syncUI(); // Initial sync to catch locks cleared by pre-filled letters

        document.getElementById('completion-overlay').classList.add('hidden');
        document.getElementById('completion-overlay').classList.remove('visible');

        if (wasActive) setTimeout(() => this.solver.start(), 1000);
    }

    showValidationError(errors, levelData) {
        const overlay = document.getElementById('validation-overlay');
        const list = document.getElementById('validation-errors-list');
        document.getElementById('failed-level-id').innerText = this.currentLevelId;
        list.innerHTML = '';

        errors.forEach(err => {
            const div = document.createElement('div');
            div.className = 'error-item';
            div.innerHTML = `<span>(Error ${err.code})</span> <span>${err.desc}</span>`;
            list.appendChild(div);
        });

        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('visible'), 50);

        // UI Feedback: Set level number and clear board
        document.getElementById('current-level-num').innerText = this.currentLevelId;
        document.getElementById('puzzle-board').innerHTML = '';
        document.getElementById('quote-text').innerText = 'Validation Failed';
        document.getElementById('quote-author').innerText = '';

        // --- REPORT FAILURE ---
        this.reportStatus(this.currentLevelId, levelData.phrase, 'FAIL', errors.map(e => e.desc).join(' | '));
    }

    async reportStatus(level, sentence, status, reason) {
        // --- Update Internal Stats ---
        if (status === 'PASS') {
            this.stats.pass++;
            document.getElementById('stat-pass-count').innerText = this.stats.pass;
        } else {
            this.stats.fail++;
            document.getElementById('stat-fail-count').innerText = this.stats.fail;
        }
        this.stats.levels.push({ level, status });
        if (this.resultsChart) this.updateStatsChart();

        try {
            const config = this.getAutomationConfig();
            // Log to CSV (Server handles auto-emailing on batches)
            await fetch(`${this.reportServiceUrl}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: parseInt(level),
                    sentence,
                    status,
                    reason,
                    reportName: config.reportName
                })
            });
        } catch (e) {
            console.error("Reporting Service Offline. Run reporter_service.py", e);
        }
    }

    initStatsDashboard() {
        console.log("Initializing Stats Dashboard...");
        const ctx = document.getElementById('live-results-chart');
        if (!ctx) {
            console.error("Canvas 'live-results-chart' not found!");
            return;
        }
        if (this.resultsChart) {
            console.log("Chart already exists, updating...");
            this.updateStatsChart();
            return;
        }

        try {
            this.resultsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Pass',
                        data: [],
                        backgroundColor: '#10b981',
                        borderRadius: 2,
                        barThickness: 'flex'
                    }, {
                        label: 'Fail',
                        data: [],
                        backgroundColor: '#ef4444',
                        borderRadius: 2,
                        barThickness: 'flex'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false, // Performance for large datasets
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: {
                                color: '#94a3b8',
                                maxRotation: 90,
                                minRotation: 90,
                                autoSkip: true,
                                maxTicksLimit: 20 // Only show ~20 labels even for thousands
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8', stepSize: 1 }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#f8fafc', font: { family: 'Outfit' } }
                        },
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false
                        }
                    }
                }
            });
            this.updateStatsChart();
        } catch (err) {
            console.error("Chart.js Error:", err);
        }
    }

    updateStatsChart() {
        if (!this.resultsChart) return;

        // Show ALL results for 4000+ level validation, 
        // with autoSkip handling the visibility in Chart.js config
        const labels = this.stats.levels.map(s => `Lv ${s.level}`);
        const passData = this.stats.levels.map(s => s.status === 'PASS' ? 1 : 0);
        const failData = this.stats.levels.map(s => s.status === 'FAIL' ? 1 : 0);

        this.resultsChart.data.labels = labels;
        this.resultsChart.data.datasets[0].data = passData;
        this.resultsChart.data.datasets[1].data = failData;

        // Dynamic bar width optimization
        const count = this.stats.levels.length;
        if (count > 500) {
            this.resultsChart.data.datasets[0].barPercentage = 1.0;
            this.resultsChart.data.datasets[0].categoryPercentage = 1.0;
        }

        this.resultsChart.update('none'); // Update without animation for speed
    }

    renderBoard() {
        const board = document.getElementById('puzzle-board');
        board.innerHTML = '';

        // Group nodes by word
        let currentWordBlock = document.createElement('div');
        currentWordBlock.className = 'word-block';

        let lastWordId = 0;

        this.logic.nodes.forEach(node => {
            if (node.wordId !== lastWordId) {
                board.appendChild(currentWordBlock);
                currentWordBlock = document.createElement('div');
                currentWordBlock.className = 'word-block';
                lastWordId = node.wordId;
            }

            const cell = document.createElement('div');
            cell.className = `cell ${node.isPunctuation ? 'punctuation' : ''} ${node.isBlank ? 'blank' : 'prefilled'}`;
            cell.id = `cell-${node.index}`;

            if (node.isBlank) {
                const lockSystem = document.createElement('div');
                lockSystem.className = 'lock-system';

                const clockTop = document.createElement('div');
                clockTop.className = 'lock-clock top';
                clockTop.innerText = '🕒';

                const clockBottom = document.createElement('div');
                clockBottom.className = 'lock-clock bottom';
                clockBottom.innerText = '🕒';

                lockSystem.appendChild(clockTop);
                lockSystem.appendChild(clockBottom);
                cell.appendChild(lockSystem);

                if (node.lockType === 1) cell.classList.add('l1-locked');
                if (node.lockType === 2) cell.classList.add('l2-locked');
                if (node.isCloaked) cell.classList.add('cloaked');

                const number = document.createElement('div');
                number.className = 'number';
                number.innerText = node.isCloaked ? '??' : node.mappingNumber;
                cell.appendChild(number);
            }

            const letter = document.createElement('div');
            letter.className = 'letter';
            letter.innerText = node.userChar || '';
            cell.appendChild(letter);

            currentWordBlock.appendChild(cell);
        });

        board.appendChild(currentWordBlock);
    }

    renderKeyboard() {
        const kb = document.getElementById('keyboard');
        const qwerty = "QWERTYUIOPASDFGHJKLZXCVBNM";
        qwerty.split('').forEach(char => {
            const key = document.createElement('div');
            key.className = 'key';
            key.innerText = char;
            key.id = `key-${char}`;
            kb.appendChild(key);
        });
    }

    /**
     * Triggered by Solver OR Human click
     */
    simulateKeyPress(mappingNumber, char) {
        this.logic.setUserChar(mappingNumber, char);
        this.syncUI(char);

        if (this.logic.checkWin()) {
            this.showWin();
        }
    }

    /**
     * Synchronizes the entire board state with the logic model
     */
    syncUI(lastTypedChar) {
        this.logic.nodes.forEach(node => {
            const cell = document.getElementById(`cell-${node.index}`);
            if (!cell) return;

            // 1. Update Letter
            const letterEl = cell.querySelector('.letter');
            if (letterEl) {
                letterEl.innerText = node.userChar || '';
            }

            // 2. Update Classes based on state
            if (node.isFilled) {
                cell.classList.add('filled');
                cell.classList.remove('l1-locked', 'l2-locked', 'strength-1', 'cloaked');
            } else if (!node.isCloaked) {
                cell.classList.remove('cloaked');
            }

            // 3. Update Locks
            // 3. Update Mapping Numbers
            if (node.isBlank) {
                const numEl = cell.querySelector('.number');
                if (numEl) {
                    // Reveal number if it's filled OR if the logic has uncloaked it
                    const shouldHide = node.isCloaked && !node.isFilled;
                    numEl.innerText = shouldHide ? '??' : node.mappingNumber;

                    if (shouldHide || node.lockType > 0) {
                        numEl.style.display = 'none'; // Only show when usable/safe
                    } else {
                        numEl.style.display = 'block';
                    }
                }

                if (node.lockType === 0) {
                    if (cell.classList.contains('l1-locked') || cell.classList.contains('l2-locked')) {
                        cell.classList.remove('l1-locked', 'l2-locked', 'strength-1');
                        cell.classList.add('lock-opening');
                    }
                } else if (node.lockType === 2 && node.lockStrength === 1) {
                    cell.classList.add('strength-1');
                    cell.classList.remove('l1-locked');
                }
            }
        });

        // Highlight Keyboard
        if (lastTypedChar) {
            const keyEl = document.getElementById(`key-${lastTypedChar.toUpperCase()}`);
            if (keyEl) {
                keyEl.classList.add('active');
                setTimeout(() => keyEl.classList.remove('active'), 200);
            }
        }
    }

    handlePhysicalKey(e) {
        if (this.solver.isActive) return;
        // Basic human gameplay logic here... (omitted for brevity, focus on automation)
    }

    showWin() {
        const levelData = this.levels[this.currentLevelId];
        const overlay = document.getElementById('completion-overlay');

        // Reconstruct phrase by replacing underscores with solved letters
        let blankIdx = 0;
        const solvedPhrase = this.logic.phrase.replace(/_/g, () => {
            const node = this.logic.blankNodes[blankIdx++];
            return node ? (node.userChar || node.char) : '_';
        });

        document.getElementById('completed-phrase').innerText = `"${solvedPhrase}"`;
        document.getElementById('completed-author').innerText = levelData.author || "Unknown";
        document.getElementById('completed-desc').innerText = levelData.desc || "";

        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('visible'), 50);

        // --- REPORT SUCCESS ---
        this.reportStatus(this.currentLevelId, solvedPhrase, 'PASS', 'Success');
    }

    handleContinue() {
        // Hide all possible overlays
        document.getElementById('completion-overlay').classList.add('hidden');
        document.getElementById('completion-overlay').classList.remove('visible');
        document.getElementById('validation-overlay').classList.add('hidden');
        document.getElementById('validation-overlay').classList.remove('visible');

        const currentIndex = this.levelIds.indexOf(this.currentLevelId);
        if (currentIndex === -1 || this.levelIds.length === 0) {
            console.error("Next level search failed. levelIds empty or current ID not found.");
            return;
        }
        const nextIndex = (currentIndex + 1) % this.levelIds.length;
        const nextLevelId = this.levelIds[nextIndex];

        console.log(`handleContinue: Proceeding to Level ${nextLevelId}`);
        this.loadLevel(nextLevelId);

        // Auto-Start solver after a small delay
        setTimeout(() => {
            if (!this.solver.isActive) this.solver.start();
        }, 1000);
    }

    toggleAutoPlayBtn(active) {
        const btn = document.getElementById('auto-play-btn');
        if (active) {
            btn.innerHTML = '<span class="icon">⏹</span> Stop Auto-Solve';
            btn.classList.add('btn-danger');
            btn.classList.remove('btn-primary', 'pulse');
        } else {
            btn.innerHTML = '<span class="icon">▶</span> Start Auto-Solve';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary', 'pulse');
        }
    }

    // --- AUTOMATION UI HELPERS ---

    initAutomationDefaults() {
        const emailChips = document.getElementById('email-chips');
        if (emailChips && emailChips.children.length === 0) {
            this.addEmailChip('ajith@quriousbit.com');
        }
    }

    setupAutomationControls() {
        // Typing Speed Slider
        const speedInput = document.getElementById('typing-speed');
        const speedVal = document.getElementById('speed-val');
        if (speedInput && speedVal) {
            speedInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                speedVal.innerText = `${val}ms`;
                // Real-time update to solver if active
                if (this.solver) {
                    this.solver.typingSpeed = val;
                }
            });
        }

        // File Upload Processing
        const fileInput = document.getElementById('json-upload');
        const fileName = document.getElementById('json-filename');
        const fileControl = document.querySelector('.auto-row .file-control'); // Targeting the wrapper

        if (fileInput && fileName) {
            // Make the whole control clickable
            if (fileControl) {
                fileControl.style.cursor = 'pointer';
                fileControl.onclick = (e) => {
                    if (e.target !== fileInput && !e.target.closest('label')) {
                        fileInput.click();
                    }
                };
            }

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileName.innerText = file.name;
                    // Read and Load content immediately
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const data = JSON.parse(event.target.result);
                            console.log("Uploaded JSON parsed:", data);

                            // Validate and Load
                            if (data && typeof data === 'object') {
                                this.levels = data;
                                this.levelIds = Object.keys(this.levels).filter(k => !isNaN(parseInt(k))).sort((a, b) => parseInt(a) - parseInt(b));
                                console.log(`Loaded ${this.levelIds.length} levels from upload.`);
                            } else {
                                alert("Invalid JSON format");
                            }
                        } catch (err) {
                            console.error("Error parsing JSON:", err);
                            alert("Failed to parse JSON file");
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }

        // Email Chips Input
        const emailInput = document.getElementById('email-add-input');
        const chipsContainer = document.getElementById('email-chips');
        if (emailInput && chipsContainer) {
            emailInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const email = emailInput.value.replace(',', '').trim();
                    if (email) {
                        this.addEmailChip(email);
                        emailInput.value = '';
                    }
                } else if (e.key === 'Backspace' && emailInput.value === '') {
                    if (chipsContainer.lastElementChild) {
                        chipsContainer.removeChild(chipsContainer.lastElementChild);
                    }
                }
            });
        }

        // Toggle between New Name and Existing Dropdown based on mode
        const modeRadios = document.querySelectorAll('input[name="report-mode"]');
        const newContainer = document.getElementById('new-report-name-container');
        const existingContainer = document.getElementById('existing-reports-container');

        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                if (mode === 'new') {
                    if (newContainer) newContainer.style.display = 'block';
                    if (existingContainer) existingContainer.style.display = 'none';
                } else {
                    if (newContainer) newContainer.style.display = 'none';
                    if (existingContainer) existingContainer.style.display = 'block';
                }
            });
        });

        // Existing Reports Selection Sync
        const existingReportsSelect = document.getElementById('existing-reports');
        const reportNameInput = document.getElementById('report-name');
        if (existingReportsSelect && reportNameInput) {
            existingReportsSelect.addEventListener('change', (e) => {
                const selected = e.target.value;
                if (selected) {
                    reportNameInput.dataset.selectedValue = selected;
                }
            });
        }

        // --- NEW: Delete Report Logic ---
        const deleteBtn = document.getElementById('delete-report-btn');
        if (deleteBtn && existingReportsSelect) {
            deleteBtn.addEventListener('click', async () => {
                const selectedReport = existingReportsSelect.value;
                if (!selectedReport) {
                    alert("Please select a report to delete first!");
                    return;
                }

                const password = prompt(`Are you sure you want to delete "${selectedReport}"?\nThis will remove BOTH the CSV and State files.\n\nPlease enter the Admin Password to confirm:`);

                if (password === null) return; // User cancelled

                try {
                    const res = await fetch(`${this.reportServiceUrl}/delete-report`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportName: selectedReport,
                            password: password
                        })
                    });

                    const result = await res.json();

                    if (res.ok) {
                        alert(`Successfully deleted: ${result.files.join(', ')}`);
                        await this.fetchExistingReports(); // Refresh drop-down
                    } else {
                        alert(`Error: ${result.error || 'Failed to delete report'}`);
                    }
                } catch (e) {
                    console.error("Delete failed:", e);
                    alert("Failed to connect to the server for deletion.");
                }
            });
        }
        // --- NEW: Download Report Logic ---
        const downloadBtn = document.getElementById('download-report-btn');
        if (downloadBtn && existingReportsSelect) {
            downloadBtn.addEventListener('click', () => {
                const selectedReport = existingReportsSelect.value;
                if (!selectedReport) {
                    alert("Please select a report to download first!");
                    return;
                }
                // Directly trigger download via URL
                window.open(`${this.reportServiceUrl}/download-report?name=${encodeURIComponent(selectedReport)}`, '_blank');
            });
        }
    }

    async fetchExistingReports() {
        try {
            const res = await fetch(`${this.reportServiceUrl}/list-reports`);
            const data = await res.json();
            console.log("Reports received from server:", data.reports);
            const select = document.getElementById('existing-reports');
            if (select && data.reports) {
                // Keep the first placeholder option
                select.innerHTML = '<option value="">-- Select Report --</option>';
                data.reports.forEach(report => {
                    const opt = document.createElement('option');
                    opt.value = report;
                    opt.textContent = report;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Failed to fetch reports:", e);
        }
    }

    addEmailChip(email) {
        const chipsContainer = document.getElementById('email-chips');
        if (!chipsContainer) return;

        const chip = document.createElement('div');
        chip.className = 'email-chip';
        // Create Span for text
        const span = document.createElement('span');
        span.innerText = email;
        chip.appendChild(span);

        // Create Remove Button
        const removeBtn = document.createElement('span');
        removeBtn.className = 'chip-remove';
        removeBtn.innerText = '✕';
        removeBtn.onclick = () => chipsContainer.removeChild(chip);
        chip.appendChild(removeBtn);

        chipsContainer.appendChild(chip);
    }

    getAutomationConfig() {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        // Get emails
        const emails = [];
        document.querySelectorAll('.email-chip span:first-child').forEach(s => emails.push(s.innerText));

        // Check if an uploaded file is active
        const uploadedFile = document.getElementById('json-filename').innerText.trim();
        const jsonFileName = uploadedFile || 'level_v3.json';

        // Get report mode
        const modeEl = document.querySelector('input[name="report-mode"]:checked');
        const reportMode = modeEl ? modeEl.value : null;

        // Get report name (Depends on Mode)
        let reportName = '';
        if (reportMode === 'new') {
            reportName = getVal('report-name').trim();
        } else if (reportMode === 'reset' || reportMode === 'continue') {
            reportName = getVal('existing-reports').trim();
        }

        return {
            jsonFile: jsonFileName,
            reportName: reportName,
            reportMode: reportMode,
            batchSize: parseInt(getVal('batch-size')) || 2000,
            typingSpeed: parseInt(getVal('typing-speed')) || 100,
            startLevel: getVal('start-level-input') || "1",
            emails: emails,
            subject: getVal('email-subject'),
            body: getVal('email-body')
        };
    }

    async configureReporter(config) {
        try {
            await fetch(`${this.reportServiceUrl}/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            console.log("Reporter Service Configured Successfully");
        } catch (e) {
            console.error("Failed to configure Reporter Service. Is python script running?", e);
        }
    }

    // --- JSON COMPARISON TOOL LOGIC ---

    setupComparisonControls() {
        this.comparisonData = {
            variant: null,
            control: null
        };

        const setupZone = (id, type) => {
            const zone = document.getElementById(id);
            const input = document.getElementById(`${type}-upload`);
            const label = document.getElementById(`${type}-filename`);

            if (!zone || !input) return;

            // Make zone clickable but avoid double-trigger if label is clicked
            zone.style.cursor = 'pointer';
            zone.onclick = (e) => {
                if (e.target !== input && !e.target.closest('label')) {
                    input.click();
                }
            };

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) this.processComparisonFile(type, file, label);
            });

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.processComparisonFile(type, file, label);
            });
        };

        setupZone('variant-drop-zone', 'variant');
        setupZone('control-drop-zone', 'control');

        // Start Comparison
        document.getElementById('start-comparison-btn').addEventListener('click', () => {
            this.compareJSONs();
        });

        // Download Results
        document.getElementById('download-results-btn').addEventListener('click', () => {
            this.downloadComparisonResults();
        });
    }

    processComparisonFile(type, file, labelEl) {
        if (!file.name.endsWith('.json')) {
            alert("Please upload a .json file");
            return;
        }

        labelEl.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.comparisonData[type] = JSON.parse(e.target.result);
                console.log(`Loaded ${type} JSON with ${Object.keys(this.comparisonData[type]).length} levels`);
            } catch (err) {
                alert(`Error parsing ${type} JSON`);
            }
        };
        reader.readAsText(file);
    }

    compareJSONs() {
        const { variant, control } = this.comparisonData;

        if (!variant || !control) {
            alert("Please upload both Variant and Control JSON files.");
            return;
        }

        const results = [];
        const unmatchedLevels = [];
        const gapLevels = [];
        const variantSpacingLevels = [];
        const controlSpacingLevels = [];

        // Identify all unique levels across both files
        const allLevels = Array.from(new Set([
            ...Object.keys(variant),
            ...Object.keys(control)
        ])).filter(k => !isNaN(parseInt(k))).sort((a, b) => parseInt(a) - parseInt(b));

        allLevels.forEach(levelId => {
            const vData = variant[levelId] || null;
            const cData = control[levelId] || null;

            const row = {
                level: levelId,
                variantMatch: !!vData,
                controlMatch: !!cData,
                isMatch: false,
                vPhrase: vData ? vData.phrase : '-',
                cPhrase: cData ? cData.phrase : '-',
                isSpacingIssue: false,
                isVariantSpacing: false,
                isControlSpacing: false,
                details: vData || cData || {}
            };

            // 1. Detect Double Spaces in Variant
            if (vData && vData.phrase && vData.phrase.includes('  ')) {
                row.isVariantSpacing = true;
                variantSpacingLevels.push(levelId);
            }

            // 2. Detect Double Spaces in Control
            if (cData && cData.phrase && cData.phrase.includes('  ')) {
                row.isControlSpacing = true;
                controlSpacingLevels.push(levelId);
            }

            if (vData && cData) {
                // Perform Deep Comparison of required fields
                const fields = ['phrase', 'answer', 'solv', 'author', 'desc', 'locks1', 'locks2', 'cloak'];
                row.isMatch = fields.every(field => {
                    const vVal = vData[field];
                    const cVal = cData[field];

                    if (Array.isArray(vVal) && Array.isArray(cVal)) {
                        return vVal.length === cVal.length && vVal.every((val, i) => val === cVal[i]);
                    }
                    return vVal === cVal;
                });

                // 3. Detect Mismatch Spacing (Normalize)
                if (!row.isMatch && vData.phrase && cData.phrase) {
                    const normalize = s => s.replace(/\s+/g, ' ').trim();
                    if (normalize(vData.phrase) === normalize(cData.phrase)) {
                        row.isSpacingIssue = true;
                        gapLevels.push(levelId);
                    }
                }
            }

            if (!row.isMatch && !row.isSpacingIssue) {
                unmatchedLevels.push(levelId);
            }

            results.push(row);
        });

        this.renderComparisonTable(results, unmatchedLevels, gapLevels, variantSpacingLevels, controlSpacingLevels);
        this.lastResults = results; // Store for download
    }

    renderComparisonTable(results, unmatched, gaps, vSpacing, cSpacing) {
        const container = document.getElementById('comparison-results-container');
        const tbody = document.getElementById('comparison-table-body');

        const unmatchedBanner = document.getElementById('unmatched-levels-banner');
        const unmatchedList = document.getElementById('unmatched-levels-list');

        const gapBanner = document.getElementById('gap-levels-banner');
        const gapList = document.getElementById('gap-levels-list');

        const vSpacingBanner = document.getElementById('variant-spacing-banner');
        const vSpacingList = document.getElementById('variant-spacing-list');

        const cSpacingBanner = document.getElementById('control-spacing-banner');
        const cSpacingList = document.getElementById('control-spacing-list');

        container.classList.remove('hidden');
        tbody.innerHTML = '';

        // Handle Banners
        const setupBanner = (banner, list, items) => {
            if (items && items.length > 0) {
                banner.classList.remove('hidden');
                list.innerHTML = items.map(lv => `<span class="unmatched-item">${lv}</span>`).join('');
            } else {
                banner.classList.add('hidden');
            }
        };

        setupBanner(unmatchedBanner, unmatchedList, unmatched);
        setupBanner(gapBanner, gapList, gaps);
        setupBanner(vSpacingBanner, vSpacingList, vSpacing);
        setupBanner(cSpacingBanner, cSpacingList, cSpacing);

        // Show rows with ANY kind of issue
        results.filter(row => !row.isMatch || row.isVariantSpacing || row.isControlSpacing).forEach(row => {
            const tr = document.createElement('tr');

            if (row.isSpacingIssue) tr.className = 'row-spacing-issue';
            else if (!row.isMatch) tr.className = 'row-unmatched';
            else tr.className = 'row-spacing-warning'; // For matching phrases but having double spaces

            const highlightSpaces = (str) => {
                if (!str) return '-';
                // Highlight triple spaces, double spaces differently if possible, or just all multi-spaces
                return str.replace(/ {2,}/g, m => `<span class="highlight-space" title="${m.length} spaces">${'&nbsp;'.repeat(m.length)}</span>`);
            };

            tr.innerHTML = `
                <td>${row.level}</td>
                <td title="${row.vPhrase}">${highlightSpaces(row.vPhrase)}</td>
                <td title="${row.cPhrase}">${highlightSpaces(row.cPhrase)}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    downloadComparisonResults() {
        if (!this.lastResults) return;

        const headers = ["Level", "Variant-Phrase", "Control-Phrase", "Answer", "Solv", "Author", "Desc", "Locks1", "Locks2", "Cloak", "Variant-Status", "Control-Status", "Overall-Match", "Variant-Spacing-Issue", "Control-Spacing-Issue"];
        const rows = this.lastResults.map(r => {
            const d = r.details;
            const fmt = (arr) => Array.isArray(arr) ? `"${arr.join(',')}"` : (arr || '');
            return [
                r.level,
                `"${(r.vPhrase || '').replace(/"/g, '""')}"`,
                `"${(r.cPhrase || '').replace(/"/g, '""')}"`,
                d.answer || '',
                d.solv || '',
                `"${(d.author || '').replace(/"/g, '""')}"`,
                `"${(d.desc || '').replace(/"/g, '""')}"`,
                fmt(d.locks1),
                fmt(d.locks2),
                fmt(d.cloak),
                r.variantMatch ? "Matched" : "Unmatched",
                r.controlMatch ? "Matched" : "Unmatched",
                r.isMatch ? "YES" : "NO",
                r.isVariantSpacing ? "YES" : "NO",
                r.isControlSpacing ? "YES" : "NO"
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `json_comparison_report_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- PHRASE CHECK TOOL LOGIC ---

    setupPhraseCheckControls() {
        this.phraseCheckRawData = null;
        this.phraseCheckProcessedResults = null;

        const zone = document.getElementById('phrase-check-drop-zone');
        const input = document.getElementById('phrase-check-file-input');
        const fileNameEl = document.getElementById('phrase-check-file-name');
        const startBtn = document.getElementById('start-phrase-check-btn');

        if (!zone || !input) return;

        zone.onclick = (e) => {
            if (e.target !== input && !e.target.closest('label')) {
                input.click();
            }
        };


        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.handlePhraseCheckFile(file, fileNameEl, startBtn);
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handlePhraseCheckFile(file, fileNameEl, startBtn);
        });

        startBtn.addEventListener('click', () => {
            this.runPhraseCheckValidation();
        });

        document.getElementById('download-pc-results-btn').addEventListener('click', () => {
            this.downloadPhraseCheckResults();
        });
    }

    handlePhraseCheckFile(file, labelEl, startBtn) {
        if (!file.name.endsWith('.csv')) {
            alert("Please upload a .csv file");
            return;
        }

        labelEl.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.phraseCheckRawData = e.target.result;
            startBtn.disabled = false;
        };
        reader.readAsText(file);
    }

    runPhraseCheckValidation() {
        if (!this.phraseCheckRawData) return;

        const startBtn = document.getElementById('start-phrase-check-btn');
        startBtn.innerText = "⏳ Validation...";
        startBtn.disabled = true;

        const rows = this.parseCSVData(this.phraseCheckRawData);
        if (rows.length < 2) {
            alert("CSV is empty or invalid structure");
            startBtn.innerText = "▶ Start Validation";
            startBtn.disabled = false;
            return;
        }

        const headers = rows[0].map(h => h.toLowerCase());
        const phraseIdx = headers.indexOf('complete phrase');
        const puzzleIdx = headers.indexOf('puzzle');

        if (phraseIdx === -1 || puzzleIdx === -1) {
            alert("Required columns 'Complete Phrase' and 'Puzzle' not found in CSV.");
            startBtn.innerText = "▶ Start Validation";
            startBtn.disabled = false;
            return;
        }

        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        // Skip header
        for (let i = 1; i < rows.length; i++) {
            const rowValues = rows[i];
            const phrase = rowValues[phraseIdx] || "";
            const puzzle = rowValues[puzzleIdx] || "";

            if (!phrase && !puzzle) continue;

            const { codes, desc } = this.validateCompletePhrase(phrase, puzzle);

            if (codes === "0") validCount++;
            else invalidCount++;

            results.push({
                row: i,
                phrase,
                puzzle,
                codes,
                desc,
                originalRow: rowValues
            });
        }

        this.phraseCheckProcessedResults = results;
        this.phraseCheckHeaders = rows[0];
        this.renderPhraseCheckTable(results, validCount, invalidCount);

        startBtn.innerText = "✅ Validation Complete";
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-success');
    }

    parseCSVData(csvText) {
        const rows = [];
        let currentRow = [];
        let currentCell = "";
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            let char = csvText[i];
            let nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentCell);
                currentCell = "";
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentCell = "";
                currentRow = [];
                if (char === '\r' && nextChar === '\n') i++;
            } else {
                currentCell += char;
            }
        }
        if (currentRow.length > 0 || currentCell !== "") {
            currentRow.push(currentCell);
            rows.push(currentRow);
        }
        return rows.filter(row => row.some(cell => cell.trim() !== ""));
    }

    renderPhraseCheckTable(results, valid, invalid) {
        const container = document.getElementById('phrase-check-results-container');
        const tbody = document.getElementById('phrase-check-table-body');

        document.getElementById('pc-total-count').innerText = results.length;
        document.getElementById('pc-valid-count').innerText = valid;
        document.getElementById('pc-invalid-count').innerText = invalid;

        container.classList.remove('hidden');
        tbody.innerHTML = '';

        results.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = row.codes === "0" ? 'row-valid' : 'row-error';
            tr.innerHTML = `
                <td>${row.row}</td>
                <td title="${row.phrase}">${row.phrase}</td>
                <td><code style="background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px;">${row.puzzle}</code></td>
                <td><span class="match-status ${row.codes === "0" ? 'match-success' : 'match-fail'}">${row.codes}</span></td>
                <td style="font-size: 0.85rem">${row.desc}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    validateCompletePhrase(phrase, puzzle) {
        let foundCodes = [];
        let foundDescriptions = [];
        const structuralOk = phrase.length === puzzle.length;

        // 10. Cloak rule
        if (puzzle.includes('$') && (puzzle.includes('@') || puzzle.includes('#'))) {
            foundCodes.push(10);
            foundDescriptions.push("Cloak rule violation: Puzzle contains '$' along with '@' or '#'. These cannot coexist.");
        }

        // 7, 6, 5. Phrase cleanliness
        // Error 7: Unbalanced quotes
        let quotesUnbalanced = (phrase.match(/"/g) || []).length % 2 !== 0;
        if (!quotesUnbalanced) {
            let quoteCount = 0;
            for (let i = 0; i < phrase.length; i++) {
                if (phrase[i] === "'") {
                    const isPreceded = i > 0 && /[a-zA-Z]/.test(phrase[i - 1]);
                    const isFollowed = i < phrase.length - 1 && /[a-zA-Z]/.test(phrase[i + 1]);
                    if (isPreceded && isFollowed) continue;
                    quoteCount++;
                }
            }
            if (quoteCount % 2 !== 0) quotesUnbalanced = true;
        }
        if (quotesUnbalanced) {
            foundCodes.push(7);
            foundDescriptions.push("Unbalanced quotes found. Ensure every opening ' or \" has a matching closing quote.");
        }

        // Error 5: Forbidden characters
        const forbiddenChars = /[@#\$%\^&\*\(\)“”‘’…ö\?!]|——|--/g;
        const matches = phrase.match(forbiddenChars);
        if (matches) {
            foundCodes.push(5);
            const cleanMatches = Array.from(new Set(matches)).map(c => `'${c}'`).join(', ');
            foundDescriptions.push(`Forbidden characters found: ${cleanMatches}. Use standard quotes, hyphens, and ellipses (...). Only periods are allowed for sentence endings.`);
        }

        // Error 6: Period end
        if (phrase.trim().slice(-1) !== '.') {
            foundCodes.push(6);
            foundDescriptions.push("Phrase must end with a period ('.').");
        }

        // Error 3: Structural mismatches
        if (!structuralOk) {
            foundCodes.push(3);
            foundDescriptions.push(`Length mismatch: Phrase has ${phrase.length} chars, Puzzle has ${puzzle.length}.`);
        } else {
            for (let i = 0; i < phrase.length; i++) {
                const sCharAlpha = /[a-zA-Z]/.test(phrase[i]);
                const pSlot = /[a-zA-Z_@#\$]/.test(puzzle[i]);
                if (sCharAlpha !== pSlot) {
                    foundCodes.push(3);
                    foundDescriptions.push(`Structural mismatch at position ${i}: mismatch between letter-slot and non-letter character.`);
                    break;
                }
            }
        }

        // Error 2: Capitalization
        if (phrase) {
            const firstLetterMatch = phrase.match(/[a-zA-Z]/);
            if (firstLetterMatch && firstLetterMatch[0] !== firstLetterMatch[0].toUpperCase()) {
                foundCodes.push(2);
                foundDescriptions.push("First letter of the phrase is not capitalized.");
            }

            let expectUppercase = false;
            for (let char of phrase) {
                if (char === '.') expectUppercase = true;
                else if (expectUppercase && /[a-zA-Z]/.test(char)) {
                    if (char !== char.toUpperCase()) {
                        foundCodes.push(2);
                        foundDescriptions.push("Capitalization missing after a period.");
                        break;
                    }
                    expectUppercase = false;
                } else if (expectUppercase && !/\s/.test(char)) {
                    expectUppercase = false;
                }
            }
        }

        if (structuralOk) {
            // Error 4: Char Mismatch
            for (let i = 0; i < phrase.length; i++) {
                const s_char = phrase[i];
                const p_char = puzzle[i];
                if (/[a-zA-Z]/.test(s_char)) {
                    if (p_char !== s_char && !/[_@#\$]/.test(p_char)) {
                        foundCodes.push(4);
                        foundDescriptions.push(`Invalid character '${p_char}' in Puzzle at position ${i}; expected '${s_char}' or a placeholder.`);
                        break;
                    }
                } else if (s_char !== p_char) {
                    foundCodes.push(4);
                    foundDescriptions.push(`Mismatch at position ${i}: Puzzle has '${p_char}' where Phrase has '${s_char}'.`);
                    break;
                }
            }

            // Error 1: Lock logic
            for (let i = 0; i < puzzle.length; i++) {
                const pChar = puzzle[i];
                if (pChar !== '@' && pChar !== '#') continue;

                // Find boundaries
                let start = i, end = i;
                if (!/[a-zA-Z]/.test(phrase[i])) {
                    foundCodes.push(1);
                    foundDescriptions.push(`Lock character '${pChar}' at position ${i} is incorrectly placed on a non-alphabetic character.`);
                    continue;
                }
                while (start > 0 && /[a-zA-Z]/.test(phrase[start - 1])) start--;
                while (end < phrase.length - 1 && /[a-zA-Z]/.test(phrase[end + 1])) end++;

                const wordLen = end - start + 1;
                const prevMissing = (i > start && /[_@#\$]/.test(puzzle[i - 1]));
                const nextMissing = (i < end && /[_@#\$]/.test(puzzle[i + 1]));

                if (pChar === '@') {
                    if (wordLen === 1) {
                        foundCodes.push(1);
                        foundDescriptions.push(`Single lock '@' at position ${i} cannot be on a single-letter word.`);
                    } else if (!(prevMissing || nextMissing)) {
                        foundCodes.push(1);
                        foundDescriptions.push(`Single lock '@' at position ${i} must be adjacent to another missing letter.`);
                    }
                } else if (pChar === '#') {
                    if (wordLen <= 2) {
                        foundCodes.push(1);
                        foundDescriptions.push(`Double lock '#' at position ${i} cannot be on a word of length 1 or 2.`);
                    } else if (i === start || i === end) {
                        foundCodes.push(1);
                        foundDescriptions.push(`Double lock '#' at position ${i} cannot be at the start or end of a word.`);
                    } else if (!(prevMissing && nextMissing)) {
                        foundCodes.push(1);
                        foundDescriptions.push(`Double lock '#' at position ${i} must be between two other missing letters.`);
                    }
                }
            }
        }

        if (foundCodes.length === 0) return { codes: "0", desc: "Valid" };

        const cleanCodes = Array.from(new Set(foundCodes)).sort((a, b) => b - a);
        return {
            codes: cleanCodes.join(','),
            desc: foundDescriptions.join('; ')
        };
    }

    downloadPhraseCheckResults() {
        if (!this.phraseCheckProcessedResults) return;

        const headers = [...this.phraseCheckHeaders, "Error Code", "Error Description"];
        const rows = this.phraseCheckProcessedResults.map(r => {
            const formattedRow = r.originalRow.map(val => `"${val.replace(/"/g, '""')}"`);
            formattedRow.push(`"${r.codes}"`);
            formattedRow.push(`"${r.desc.replace(/"/g, '""')}"`);
            return formattedRow.join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `phrase_check_report_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- DUPLICATION CHECK TOOL LOGIC ---

    setupDuplicateControls() {
        this.duplicateRawData = null;
        this.duplicateProcessedResults = null;

        const zone = document.getElementById('duplicate-check-drop-zone');
        const input = document.getElementById('duplicate-check-file-input');
        const fileNameEl = document.getElementById('duplicate-check-file-name');
        const startBtn = document.getElementById('start-duplicate-btn');

        if (!zone || !input) return;

        zone.onclick = (e) => {
            if (e.target !== input && !e.target.closest('label')) {
                input.click();
            }
        };


        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.handleDuplicateFile(file, fileNameEl, startBtn);
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleDuplicateFile(file, fileNameEl, startBtn);
        });

        startBtn.addEventListener('click', () => {
            this.startDuplicationCheck();
        });

        const downloadBtn = document.getElementById('download-duplicate-results-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadDuplicateResults();
            });
        }
    }

    handleDuplicateFile(file, labelEl, startBtn) {
        if (!file.name.endsWith('.csv')) {
            alert("Please upload a .csv file");
            return;
        }

        labelEl.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.duplicateRawData = e.target.result;
            startBtn.disabled = false;
        };
        reader.readAsText(file);
    }

    async startDuplicationCheck() {
        if (!this.duplicateRawData) return;

        const startBtn = document.getElementById('start-duplicate-btn');
        const progressContainer = document.getElementById('duplicate-progress-container');
        const progressFill = document.getElementById('duplicate-progress-fill');
        const progressPercent = document.getElementById('duplicate-progress-percent');
        const statusText = document.getElementById('duplicate-status-text');
        const summary = document.getElementById('duplicate-results-summary');
        const downloadBtn = document.getElementById('download-duplicate-results-btn');

        startBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        summary.classList.add('hidden');
        if (downloadBtn) downloadBtn.classList.add('hidden');
        statusText.innerText = "⏳ Initializing AI Model...";

        // Reset progress
        progressFill.style.width = "0%";
        progressPercent.innerText = "0%";

        // Simulate progress while waiting for backend
        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 95) {
                progress += Math.random() * 2;
                if (progress > 95) progress = 95;
                progressFill.style.width = `${progress}%`;
                progressPercent.innerText = `${Math.floor(progress)}%`;

                if (progress > 10) statusText.innerText = "🧠 Analyzing semantic context...";
                if (progress > 40) statusText.innerText = "⚖️ Comparing phrase embeddings...";
                if (progress > 70) statusText.innerText = "🏷️ Grouping similar sentences...";
            }
        }, 1200);

        try {
            console.log("Connecting to Duplicate Service...");
            const response = await fetch(`${this.duplicateServiceUrl}/check-duplicates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    csvContent: this.duplicateRawData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to process duplicates");
            }

            const result = await response.json();
            clearInterval(interval);

            // Success State
            progressFill.style.width = `100%`;
            progressPercent.innerText = `100%`;
            statusText.innerText = "✅ Duplication Check Complete!";

            this.duplicateProcessedResults = result.csvContent;

            // Show Stats
            summary.classList.remove('hidden');
            document.getElementById('dup-total-count').innerText = result.stats.total;
            document.getElementById('dup-group-count').innerText = result.stats.duplicateGroups;

            if (downloadBtn) downloadBtn.classList.remove('hidden');
            startBtn.innerText = "✅ Completed";
            startBtn.classList.remove('btn-primary');
            startBtn.classList.add('btn-success');

        } catch (err) {
            clearInterval(interval);
            console.error("Duplication check failed:", err);
            statusText.innerText = "❌ Error: Service Offline";
            alert(`Failed to connect to duplicate service: ${err.message}. Please ensure duplicate_service.py is running on port 8081.`);
            startBtn.disabled = false;
            startBtn.innerText = "▶ Start Duplication Validation";
        }
    }

    downloadDuplicateResults() {
        if (!this.duplicateProcessedResults) return;

        const blob = new Blob([this.duplicateProcessedResults], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `duplication_report_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- CSV COMPARISON TOOL LOGIC ---

    setupCsvComparisonControls() {
        this.csvComparisonData = {
            variant: null,
            control: null
        };

        const setupZone = (id, type) => {
            const zone = document.getElementById(id);
            const input = document.getElementById(`${type}-upload`);
            const label = document.getElementById(`${type}-filename`);

            if (!zone || !input) return;

            // Make zone clickable but avoid double-trigger if label is clicked
            zone.style.cursor = 'pointer';
            zone.onclick = (e) => {
                if (e.target !== input && !e.target.closest('label')) {
                    input.click();
                }
            };

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) this.processCsvComparisonFile(type, file, label);
            });

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.processCsvComparisonFile(type, file, label);
            });
        };

        setupZone('variant-csv-drop-zone', 'variant-csv');
        setupZone('control-csv-drop-zone', 'control-csv');

        // Start Comparison
        document.getElementById('start-csv-comparison-btn').addEventListener('click', () => {
            this.compareCSVs();
        });

        // Download Results
        document.getElementById('download-csv-comparison-results-btn').addEventListener('click', () => {
            this.downloadCsvComparisonResults();
        });
    }

    processCsvComparisonFile(type, file, labelEl) {
        if (!file.name.endsWith('.csv')) {
            alert("Please upload a .csv file");
            return;
        }

        labelEl.innerText = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = this.parseCSVData(e.target.result);
            this.csvComparisonData[type.replace('-csv', '')] = data;
            console.log(`Loaded ${type} CSV with ${data.length} rows`);
        };
        reader.readAsText(file);
    }

    compareCSVs() {
        const { variant, control } = this.csvComparisonData;

        if (!variant || !control) {
            alert("Please upload both Variant and Control CSV files.");
            return;
        }

        const mapRows = (data) => {
            const headers = data[0].map(h => h.trim().toLowerCase());
            let levelIdx = headers.indexOf('level no.');
            if (levelIdx === -1) levelIdx = headers.indexOf('level');
            if (levelIdx === -1) levelIdx = headers.indexOf('id');
            if (levelIdx === -1) levelIdx = 0; // Fallback to first column

            const phraseIdx = headers.indexOf('complete phrase');
            const puzzleIdx = headers.indexOf('puzzle');
            const authorIdx = headers.indexOf('author');
            const aboutIdx = headers.indexOf('about author');

            const map = {};
            data.slice(1).forEach(row => {
                const id = row[levelIdx];
                if (id && id.trim() !== "") {
                    map[id.trim()] = {
                        phrase: row[phraseIdx] || '',
                        puzzle: row[puzzleIdx] || '',
                        author: row[authorIdx] || '',
                        about: row[aboutIdx] || ''
                    };
                }
            });
            return map;
        };

        const vMap = mapRows(variant);
        const cMap = mapRows(control);

        const allIds = Array.from(new Set([...Object.keys(vMap), ...Object.keys(cMap)])).sort((a, b) => parseInt(a) - parseInt(b));
        const results = [];
        let matchCount = 0;
        let mismatchCount = 0;
        let vSpaceCount = 0;
        let cSpaceCount = 0;

        allIds.forEach(id => {
            const v = vMap[id] || null;
            const c = cMap[id] || null;

            const isVSpace = v && v.phrase && v.phrase.includes('  ');
            const isCSpace = c && c.phrase && c.phrase.includes('  ');

            if (isVSpace) vSpaceCount++;
            if (isCSpace) cSpaceCount++;

            if (!v || !c) {
                mismatchCount++;
                results.push({
                    id,
                    status: 'Mismatch',
                    field: 'Structure',
                    variant: v ? 'Present' : 'Missing',
                    control: c ? 'Present' : 'Missing',
                    spaceIssue: isVSpace ? 'Variant' : (isCSpace ? 'Control' : '-')
                });
                return;
            }

            const fields = [
                { key: 'phrase', label: 'Complete Phrase' },
                { key: 'puzzle', label: 'Puzzle' },
                { key: 'author', label: 'Author' },
                { key: 'about', label: 'About Author' }
            ];

            let rowMatched = true;
            let mismatchFields = [];
            fields.forEach(f => {
                if (v[f.key] !== c[f.key]) {
                    rowMatched = false;
                    mismatchFields.push(f.label);
                }
            });

            const spaceStatus = (isVSpace && isCSpace) ? "Both" : (isVSpace ? "Variant" : (isCSpace ? "Control" : "-"));

            if (rowMatched) {
                matchCount++;
                results.push({
                    id,
                    status: 'Match',
                    field: 'All',
                    variant: '-',
                    control: '-',
                    spaceIssue: spaceStatus
                });
            } else {
                mismatchCount++;
                mismatchFields.forEach(fLabel => {
                    const fKey = fields.find(fd => fd.label === fLabel).key;
                    results.push({
                        id,
                        status: 'Mismatch',
                        field: fLabel,
                        variant: v[fKey],
                        control: c[fKey],
                        spaceIssue: spaceStatus
                    });
                });
            }
        });

        this.renderCsvComparisonTable(results, allIds.length, matchCount, mismatchCount, vSpaceCount, cSpaceCount);
        this.csvLastResults = results;
    }

    renderCsvComparisonTable(results, total, match, mismatch, vSpace, cSpace) {
        document.getElementById('csv-comparison-results-container').classList.remove('hidden');
        document.getElementById('csv-total-count').innerText = total;
        document.getElementById('csv-match-count').innerText = match;
        document.getElementById('csv-mismatch-count').innerText = mismatch;
        document.getElementById('csv-v-space-count').innerText = vSpace;
        document.getElementById('csv-c-space-count').innerText = cSpace;

        const tbody = document.getElementById('csv-comparison-table-body');
        tbody.innerHTML = '';

        const highlightSpaces = (str) => {
            if (!str || str === '-') return str;
            return str.replace(/ {2,}/g, m => `<span class="highlight-space" title="${m.length} spaces">${'&nbsp;'.repeat(m.length)}</span>`);
        };

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.className = res.status === 'Match' ? 'row-valid' : 'row-error';
            if (res.spaceIssue !== '-') tr.classList.add('row-spacing-warning');

            tr.innerHTML = `
                <td>${res.id}</td>
                <td><span class="match-status ${res.status === 'Match' ? 'match-success' : 'match-fail'}">${res.status}</span></td>
                <td>${res.field}</td>
                <td title="${res.variant}">${highlightSpaces(res.variant)}</td>
                <td title="${res.control}">${highlightSpaces(res.control)}</td>
                <td><span class="match-status ${res.spaceIssue === '-' ? 'match-success' : 'match-fail'}" style="background: ${res.spaceIssue === '-' ? '' : 'rgba(234, 179, 8, 0.2)'}; color: ${res.spaceIssue === '-' ? '' : '#eab308'}">${res.spaceIssue}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    downloadCsvComparisonResults() {
        if (!this.csvLastResults) return;

        const headers = ["Level No.", "Status", "Field", "Variant Value", "Control Value", "Space Issue"];
        const rows = this.csvLastResults.map(r => [
            r.id,
            r.status,
            r.field,
            `"${(r.variant || '').replace(/"/g, '""')}"`,
            `"${(r.control || '').replace(/"/g, '""')}"`,
            r.spaceIssue
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `csv_comparison_report_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

}

// Start Game
window.game = new CodewordsGame();
