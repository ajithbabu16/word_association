/**
 * Automation Script - Mimics Human Interaction
 */

class CodewordsSolver {
    constructor(gameManager) {
        this.game = gameManager; // Reference to the UI/Main controller
        this.isActive = false;
        this.typingSpeed = 100; // Slower speed so you can follow the logic easily
        this.statusEl = document.getElementById('solver-status');
        this.phaseEl = document.getElementById('solve-phase');
        this.moveEl = document.getElementById('solve-move');
    }

    async start() {
        if (this.isActive) return;
        this.isActive = true;
        this.statusEl.classList.remove('hidden');
        this.game.toggleAutoPlayBtn(true);

        console.log("Solver: Starting automation sequence...");
        await this.solveSequence();
    }

    stop() {
        this.isActive = false;
        this.statusEl.classList.add('hidden');
        this.game.toggleAutoPlayBtn(false);
    }

    async solveSequence() {
        while (this.isActive && !this.game.logic.checkWin()) {
            const nextMove = this.calculateNextMove();

            if (!nextMove) {
                console.warn("Solver: Stuck! No logical moves found.");
                this.phaseEl.innerText = "Stuck (Logic Gap)";
                this.stop();
                break;
            }

            this.phaseEl.innerText = nextMove.type === 'logic' ? "Strategic Fill" : "Heuristic Guess";
            this.moveEl.innerText = `${nextMove.char} on #${nextMove.mapping}`;

            // 1. "Human" Pause
            await new Promise(r => setTimeout(r, this.typingSpeed));

            // 2. Perform Interaction
            this.game.simulateKeyPress(nextMove.mapping, nextMove.char);

            // Small pause after fill to let UI update
            await new Promise(r => setTimeout(r, 100));
        }

        if (this.game.logic.checkWin()) {
            this.phaseEl.innerText = "Level Complete!";
            this.moveEl.innerText = "Advancing...";

            // Auto Click Continue after Level Clear
            console.log("Solver: Level cleared! Waiting 2s for UI transition...");
            await new Promise(r => setTimeout(r, 2000));

            const continueBtn = document.getElementById('continue-btn');
            if (continueBtn) {
                console.log("Solver: Clicking 'Continue' button now.");
                continueBtn.click();
            } else {
                console.error("Solver ERROR: Could not find 'continue-btn' element!");
            }

            // Restart solver on next level if still active
            if (this.isActive) {
                console.log("Solver: Starting next level in 1.5s...");
                setTimeout(() => {
                    if (this.isActive) {
                        this.solveSequence();
                    }
                }, 1500);
            }
        }
    }

    calculateNextMove() {
        const logic = this.game.logic;
        const blanks = logic.blankNodes.filter(n => !n.isFilled);

        if (blanks.length === 0) return null;

        // Rule 1: Find any blank that is NOT locked and whose mapping is ALREADY KNOWN
        const knownMove = blanks.find(n => n.lockType === 0 && logic.knownMappings.has(n.mappingNumber));
        if (knownMove) {
            return {
                type: 'logic',
                mapping: knownMove.mappingNumber,
                char: logic.reverseCipher[knownMove.mappingNumber]
            };
        }

        // Rule 2: Find any blank that is NOT locked (even if mapping is unknown)
        // In Codewords, finding an unlocked blank allows you to "guess" based on word context.
        // We prioritize un-cloaked ones.
        const unlockedMove = blanks.find(n => n.lockType === 0 && !n.isCloaked);
        if (unlockedMove) {
            return {
                type: 'logic',
                mapping: unlockedMove.mappingNumber,
                char: logic.reverseCipher[unlockedMove.mappingNumber]
            };
        }

        // Rule 3: Heuristic - Try a cloaked un-locked node (Guess)
        const cloakedMove = blanks.find(n => n.lockType === 0 && n.isCloaked);
        if (cloakedMove) {
            return {
                type: 'guess',
                mapping: cloakedMove.mappingNumber,
                char: logic.reverseCipher[cloakedMove.mappingNumber]
            };
        }

        // Rule 4: Emergency Fallback - If everything is locked, pick the FIRST blank to break the lock
        // This is often needed at the very start of a hard level
        const fallbackMove = blanks[0];
        if (fallbackMove) {
            return {
                type: 'emergency',
                mapping: fallbackMove.mappingNumber,
                char: logic.reverseCipher[fallbackMove.mappingNumber]
            };
        }

        return null;
    }
}

window.CodewordsSolver = CodewordsSolver;
