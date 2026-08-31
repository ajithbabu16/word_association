/**
 * Codewords Game Logic Engine (Ported from logic_validator.py)
 */

class CodewordsLogic {
    constructor() {
        this.reset();
    }

    reset() {
        this.nodes = [];
        this.blankNodes = [];
        this.cipher = {}; // mapping letter -> number
        this.reverseCipher = {}; // mapping number -> letter (the target)
        this.currentMapping = {}; // number -> letter user has entered
        this.knownMappings = new Set(); // Mappings that are revealed/solved
        this.phrase = "";
        this.answer = "";
        this.totalBlanks = 0;
    }

    /**
     * Parse level data and initialize internal state
     */
    initLevel(levelData) {
        this.reset();
        this.phrase = levelData.phrase;
        this.answer = levelData.answer;

        const locks1 = levelData.locks1 || [];
        const locks2 = levelData.locks2 || [];
        const cloaks = levelData.cloak || [];

        // Generate the mapping cipher (seeded for consistency per level)
        // In a real game, this is randomized, but for automation/demo we match the validator
        this.generateCipher(this.answer);

        let blankCounter = 0;
        const words = this.phrase.split(' ');
        let globalIndex = 0;

        words.forEach((word, wordIdx) => {
            let isSpecial = false;
            let cleanWord = word;
            if (word.startsWith("|") && word.endsWith("|")) {
                isSpecial = true;
                cleanWord = word.slice(1, -1);
            }

            for (let i = 0; i < cleanWord.length; i++) {
                const char = cleanWord[i];
                const node = {
                    char: char,
                    index: globalIndex++,
                    wordId: wordIdx,
                    isPunctuation: this.isPunctuation(char),
                    isSpecial: isSpecial,
                    isBlank: false,
                    isFilled: false,
                    userChar: '',
                    lockType: 0,
                    lockStrength: 0,
                    isCloaked: false,
                    blankIndex: -1,
                    mappingNumber: -1,
                    wasPreFilled: false
                };

                if (!node.isPunctuation && !isSpecial && char === '_') {
                    node.isBlank = true;
                    node.blankIndex = blankCounter;

                    if (locks1.includes(blankCounter)) {
                        node.lockType = 1;
                        node.lockStrength = 1;
                    } else if (locks2.includes(blankCounter)) {
                        node.lockType = 2;
                        node.lockStrength = 2;
                    }

                    if (cloaks.includes(blankCounter)) {
                        node.isCloaked = true;
                    }

                    // Assign the mapping number from the answer
                    const targetChar = this.answer[blankCounter];
                    node.mappingNumber = this.cipher[targetChar];
                    this.reverseCipher[node.mappingNumber] = targetChar;

                    this.blankNodes.push(node);
                    blankCounter++;
                } else {
                    // This handles pre-filled letters, punctuation, and special words
                    node.isFilled = true;
                    node.wasPreFilled = true;
                    node.userChar = char;
                }

                this.nodes.push(node);
            }
        });

        this.totalBlanks = blankCounter;

        // Initial lock calculation to handle pre-filled letters
        this.recalculateLocks();
    }

    isPunctuation(char) {
        return ["%", "&", '“', '”', '‘', '’', '—', '–', '…'].includes(char);
    }

    generateCipher(answer) {
        const uniqueChars = [...new Set(answer.split('').filter(c => /[a-zA-Z]/.test(c)))].sort();
        // Simplified mapping for demo: Use fixed numbers relative to alphabet or sorted unique
        // To match validator.py, we'd need a stable shuffle, but simple index is fine for UI logic
        uniqueChars.forEach((char, idx) => {
            this.cipher[char] = idx + 1;
        });
    }

    setUserChar(mappingNumber, char) {
        if (!mappingNumber || mappingNumber === -1) return [];

        const targetChar = this.reverseCipher[mappingNumber];
        const isCorrect = (targetChar.toUpperCase() === char.toUpperCase());

        if (isCorrect) {
            this.knownMappings.add(mappingNumber);
        }

        // 1. Update all matching UNLOCKED blanks
        this.blankNodes.forEach(node => {
            if (node.mappingNumber === mappingNumber && node.lockType === 0) {
                if (!node.isFilled) {
                    node.isFilled = true;
                    node.userChar = char.toUpperCase();
                }
            }
        });

        // 2. Recalculate board state (Locks)
        this.recalculateLocks();

        return this.blankNodes.map(n => n.index);
    }

    /**
     * State-based Lock Logic:
     * Recalculates strength of all locks based on current neighbor state.
     * Also handles cascading auto-reveals.
     */
    recalculateLocks() {
        let changed = true;
        let iterations = 0;

        while (changed && iterations < 5) {
            changed = false;
            iterations++;

            this.blankNodes.forEach(node => {
                if (node.lockType > 0) {
                    const left = this.getNeighbor(node, -1);
                    const right = this.getNeighbor(node, 1);

                    // A neighbor counts as "identified" ONLY if filled by player (not at start)
                    const leftIdentified = left && left.isFilled && !left.wasPreFilled;
                    const rightIdentified = right && right.isFilled && !right.wasPreFilled;

                    let newStrength = node.lockType;

                    if (node.lockType === 1) {
                        // Single: Unlocked if ANY neighbor is identified by player
                        newStrength = (leftIdentified || rightIdentified) ? 0 : 1;
                    } else if (node.lockType === 2) {
                        // Double: Requires BOTH neighbors to be identified by player
                        let count = 0;
                        if (leftIdentified) count++;
                        if (rightIdentified) count++;
                        newStrength = 2 - count;
                    }

                    if (node.lockStrength !== newStrength) {
                        node.lockStrength = newStrength;
                        if (node.lockStrength <= 0) node.lockType = 0;
                        changed = true;
                    }
                }

                // --- Cloak Logic: Strict Removal ---
                if (node.isCloaked) {
                    // Rule: Cloak is REMOVED ONLY if that specific cell is filled
                    if (node.isFilled) {
                        node.isCloaked = false;
                        changed = true;
                    }
                }
            });
        }
    }

    getNeighbor(node, direction) {
        const idx = node.index + direction;
        if (idx < 0 || idx >= this.nodes.length) return null;
        const neighbor = this.nodes[idx];
        if (neighbor.isPunctuation) return null;
        return neighbor;
    }

    validateLevelData(levelData) {
        const errors = [];
        const phrase = levelData.phrase || "";
        const locks1 = levelData.locks1 || [];
        const locks2 = levelData.locks2 || [];
        const cloaks = levelData.cloak || [];

        // Error 8: Punctuation Misuse (Double quotes used as apostrophes)
        for (let i = 1; i < phrase.length - 1; i++) {
            const char = phrase[i];
            if (['"', '“', '”'].includes(char)) {
                const left = phrase[i - 1];
                const right = phrase[i + 1];
                const isWordStruct = /[a-zA-Z_]/.test(left) && /[a-zA-Z_]/.test(right);
                if (isWordStruct) {
                    errors.push({ code: 8, desc: `Stylized quote '${char}' used as apostrophe at index ${i}. Use single quote instead.` });
                    break;
                }
            }
        }

        // Error 5: Forbidden Characters (Characters that should NEVER be in a phrase)
        const absolutelyForbidden = /[`~@#$^&*+={\[}\]|\\<>©®™€£¥ö]/;
        const foundAbsolutelyForbidden = [...new Set(phrase.split('').filter(char => absolutelyForbidden.test(char)))];
        if (foundAbsolutelyForbidden.length > 0) {
            errors.push({ code: 5, desc: "Forbidden characters: " + foundAbsolutelyForbidden.join(', ') });
        }

        // Error 3: Structural/Invalid Characters (Characters not in the allowed set)
        // Allowed: A-Z, a-z, space, underscore, and standard punctuation (. , ! ? - " ' ; : ( ) … “” ‘’)
        const allowedRegex = /^[a-zA-Z_\s.?!,\-"';:()…“”‘’—–]*$/;
        if (!allowedRegex.test(phrase)) {
            // Identify which characters are causing the mismatch
            const invalidChars = [...new Set(phrase.split('').filter(c => !allowedRegex.test(c)))];
            errors.push({ code: 3, desc: "Structural mismatch: Phrase contains invalid/unsupported characters: " + invalidChars.join(', ') });
        }


        // Error 1: Lock Logic Placement
        const words = phrase.split(' ');
        let blankCounter = 0;
        let globalIndex = 0;

        words.forEach(word => {
            let cleanWord = word;
            if (word.startsWith("|") && word.endsWith("|")) cleanWord = word.slice(1, -1);

            for (let i = 0; i < cleanWord.length; i++) {
                const char = cleanWord[i];
                if (char === '_') {
                    const isL1 = locks1.includes(blankCounter);
                    const isL2 = locks2.includes(blankCounter);

                    if (isL1 || isL2) {
                        const l_is_blank = i > 0 && cleanWord[i - 1] === '_';
                        const r_is_blank = i < cleanWord.length - 1 && cleanWord[i + 1] === '_';

                        if (isL1 && !(l_is_blank || r_is_blank)) {
                            errors.push({ code: 1, desc: `Single lock @ index ${blankCounter} must be adjacent to another blank.` });
                        }
                        if (isL2 && !(l_is_blank && r_is_blank)) {
                            errors.push({ code: 1, desc: `Double lock # @ index ${blankCounter} must be between two blanks.` });
                        }
                    }
                    blankCounter++;
                }
                globalIndex++;
            }
        });

        // Error 4: Length Mismatch
        const answerLen = (levelData.answer || "").length;
        if (blankCounter !== answerLen) {
            errors.push({
                code: 4,
                desc: `Answer length mismatch: Phrase has ${blankCounter} blanks, but Answer has ${answerLen} characters.`
            });
        }

        // Error 10: Cloak Rule
        if (cloaks.length > 0 && (locks1.length > 0 || locks2.length > 0)) {
            errors.push({ code: 10, desc: "Cloak rule violation: Cloaks cannot coexist with locks (@ or #) in the same level." });
        }

        // New V1 Cloak Rules (Min 4 total, Max 2 unique)
        if (cloaks.length > 0) {
            if (cloaks.length < 4) {
                errors.push({ code: 11, desc: `Cloak count violation: Level has only ${cloaks.length} cloaks. V1 requires at least 4 total.` });
            }

            const uniqueCloakedChars = new Set();
            cloaks.forEach(idx => {
                if (levelData.answer && levelData.answer[idx]) {
                    uniqueCloakedChars.add(levelData.answer[idx].toUpperCase());
                }
            });

            if (uniqueCloakedChars.size > 2) {
                errors.push({ code: 12, desc: `Cloak variety violation: Level has cloaks on ${uniqueCloakedChars.size} unique letters (${Array.from(uniqueCloakedChars).join(', ')}). V1 allows max 2.` });
            }
        }

        return errors;
    }

    checkWin() {
        return this.blankNodes.every(n => {
            if (!n.isFilled || !n.userChar) return false;
            const target = this.reverseCipher[n.mappingNumber];
            return n.userChar.toUpperCase() === target.toUpperCase();
        });
    }
}

// Export for use in other scripts
window.CodewordsLogic = CodewordsLogic;
