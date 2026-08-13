import type { PuzzleRawLevel, PuzzleRawGroup } from './PuzzleModels';

export interface ValidationResult {
  status: 'OK' | 'ERRORS' | 'WARNINGS';
  errors: string[];
  warnings: string[];
}

export class PuzzleValidator {

  /**
   * Build an internal dictionary from all the game's own single words.
   * This is used by the missing-space checker so it can dynamically detect
   * compound words like HORSERACING without a hardcoded list.
   */
  static buildInternalDictionary(allLevels: PuzzleRawLevel[]): Set<string> {
    const dict = new Set<string>();
    allLevels.forEach(level => {
      if (level.groups) {
        level.groups.forEach(group => {
          group.words.forEach(word => {
            const clean = word.trim().toLowerCase();
            // Only add single words (no spaces) with length > 2
            if (!clean.includes(' ') && clean.length > 2) {
              dict.add(clean);
            }
          });
        });
      }
    });
    return dict;
  }
  
  static validateStage(stage: PuzzleRawLevel, internalDict?: Set<string>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const addError = (msg: string) => { if (!errors.includes(msg)) errors.push(msg); };
    const addWarning = (msg: string) => { if (!warnings.includes(msg)) warnings.push(msg); };

    if (!stage.groups || stage.groups.length === 0) {
      return { status: 'OK', errors: [], warnings: [] };
    }

    const titleMap: Record<string, boolean> = {};
    const formationMap: Record<string, string> = {};
    const wordMap: Record<string, string> = {};
    const singularPluralMap: Record<string, { word: string, title: string }[]> = {};

    // Helper: Root Stem & Tense Forms (Singular/Plural, -ing, -ed, -er, -ers)
    const getStemForms = (word: string): string[] => {
      const w = word.trim().toLowerCase();
      const forms = new Set<string>();
      forms.add(w);

      // 1. Singular/Plural
      if (w.length > 3 && w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y');
      if (w.length > 3 && w.endsWith('es')) forms.add(w.slice(0, -2));
      if (w.length > 2 && w.endsWith('s') && !w.endsWith('ss')) forms.add(w.slice(0, -1));

      // 2. Gerund / Continuous (-ing) e.g., WALKING -> WALK, DANCING -> DANCE, RUNNING -> RUN
      if (w.length > 4 && w.endsWith('ing')) {
        const base = w.slice(0, -3);
        forms.add(base);
        forms.add(base + 'e');
        if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
          forms.add(base.slice(0, -1));
        }
      }

      // 3. Past Tense (-ed) e.g., WALKED -> WALK, DANCED -> DANCE
      if (w.length > 3 && w.endsWith('ed')) {
        const base = w.slice(0, -2);
        forms.add(base);
        forms.add(base + 'e');
        if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
          forms.add(base.slice(0, -1));
        }
      }

      // 4. Agent Nouns / Comparative (-er / -ers) e.g., WALKER -> WALK
      if (w.length > 4 && (w.endsWith('ers') || w.endsWith('er'))) {
        const base = w.endsWith('ers') ? w.slice(0, -3) : w.slice(0, -2);
        forms.add(base);
        forms.add(base + 'e');
        if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) {
          forms.add(base.slice(0, -1));
        }
      }

      return Array.from(forms);
    };

    const isStemVariation = (w1: string, w2: string): boolean => {
      const c1 = w1.trim().toLowerCase();
      const c2 = w2.trim().toLowerCase();
      if (c1 === c2) return false;
      const f1 = getStemForms(c1);
      const f2 = getStemForms(c2);
      return f1.some(f => f2.includes(f));
    };

    // Helper: Foreign Characters
    const checkForeignCharacters = (word: string): string[] => {
      const found: string[] = [];
      for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i);
        const char = word.charAt(i);
        if (code >= 0x0400 && code <= 0x04FF) found.push(`${char} (Cyrillic)`);
        if (code >= 0x0370 && code <= 0x03FF) found.push(`${char} (Greek)`);
      }
      return found;
    };

    // Helper: Mojibake - uses Unicode escapes to avoid parser issues with special chars
    const checkMojibake = (word: string): string[] => {
      const patterns = [
        "\u00C3",           // Ã
        "\u00C2",           // Â
        "\u00E2\u0080",     // â€
        "\u00E2\u0080\u0099", // â€™
        "\u00E2\u0080\u009C", // â€œ
        "\u00E2\u0080\u0093", // â€"
        "\u00E2\u0080\u0094", // â€"
        "\u00E2\u0080\u00A6", // â€¦
        "\u00F0\u009F",     // ðŸ
        "\u00C3\u0192",     // Ãƒ
        "\u00C3\u0082",     // Ã‚
      ];
      return patterns.filter(p => word.includes(p));
    };

    // Helper: Missing Spaces (uses internal dictionary from the game's own words)
    const findMissingSpace = (word: string): string[] => {
      if (!internalDict || internalDict.size === 0) return [];
      const clean = word.trim().toLowerCase();
      if (clean.length < 7 || clean.includes(' ')) return [];
      const suggestions: string[] = [];
      for (let i = 3; i <= clean.length - 3; i++) {
        const first = clean.substring(0, i);
        const second = clean.substring(i);
        if (internalDict.has(first) && internalDict.has(second)) {
          suggestions.push(`${first.toUpperCase()} ${second.toUpperCase()}`);
        }
      }
      return suggestions;
    };

    // Process Groups
    stage.groups.forEach(group => {
      // Ignore master category tags if present
      let title = group.category.replace(/:master category/gi, '').trim();
      let words = group.words.map(w => w.trim()).filter(w => w !== '');

      const titleKey = title.toLowerCase();

      // Rule 1: Duplicate Category Title
      if (titleMap[titleKey]) {
        addError(`Duplicate category title: ${title}`);
      } else {
        titleMap[titleKey] = true;
      }

      // Rule 2: Title as own word
      if (words.some(w => w.toLowerCase() === titleKey)) {
        addError(`Category title '${title}' is repeated in its own puzzle.`);
      }

      // Rule 7: Word count
      if (words.length !== 4) {
        addError(`Category '${title}' has ${words.length} words. Expected exactly 4.`);
      }

      const seenInGroup: Record<string, boolean> = {};

      words.forEach(word => {
        const wordKey = word.toLowerCase();

        // Rule 3: Duplicate word same category
        if (seenInGroup[wordKey]) {
          addError(`Duplicate word '${word}' in category '${title}'`);
        }
        seenInGroup[wordKey] = true;

        // Rule 4: Same word other category
        if (wordMap[wordKey] && wordMap[wordKey] !== title) {
          addError(`Word '${word}' is used in both '${wordMap[wordKey]}' and '${title}'`);
        } else if (!wordMap[wordKey]) {
          wordMap[wordKey] = title;
        }

        // Rule 6: Singular/Plural & Root/Tense Variations (e.g., WALK and WALKING)
        const normalizedForms = getStemForms(word);
        normalizedForms.forEach(normalized => {
          if (singularPluralMap[normalized]) {
            singularPluralMap[normalized].forEach(previous => {
              if (previous.word.toLowerCase() !== wordKey && isStemVariation(previous.word, word)) {
                if (previous.title === title) {
                  addError(`Root/tense variation '${previous.word}' and '${word}' found in the same category '${title}'`);
                } else {
                  addError(`Root/tense variation '${previous.word}' in '${previous.title}' and '${word}' in '${title}'`);
                }
              }
            });
          }
        });

        normalizedForms.forEach(form => {
          if (!singularPluralMap[form]) singularPluralMap[form] = [];
          singularPluralMap[form].push({ word, title });
        });

        // Rule 8: Foreign Character
        const foreign = checkForeignCharacters(word);
        if (foreign.length > 0) {
          addError(`Foreign character substitution detected in '${word}' in category '${title}': ${foreign.join(', ')}`);
        }

        // Rule 9: Mojibake
        const mojibake = checkMojibake(word);
        if (mojibake.length > 0) {
          addError(`Encoding/Mojibake artifact detected in '${word}' in category '${title}'`);
        }

        // Rule 10: Missing Space
        const spaceSuggestion = findMissingSpace(word);
        if (spaceSuggestion.length > 0) {
          addWarning(`Possible missing space in '${word}' in category '${title}'. Possible: ${spaceSuggestion.join(', ')}`);
        }
      });

      // Rule 5: Duplicate puzzle formation
      const formationKey = [...words].map(w => w.toLowerCase()).sort().join('|');
      if (formationMap[formationKey]) {
        addError(`Duplicate puzzle formation between '${formationMap[formationKey]}' and '${title}'`);
      } else {
        formationMap[formationKey] = title;
      }
    });

    if (errors.length > 0) return { status: 'ERRORS', errors, warnings };
    if (warnings.length > 0) return { status: 'WARNINGS', errors, warnings };
    return { status: 'OK', errors, warnings };
  }

  static validateMainPuzzleLevel(level: PuzzleRawLevel, internalDict?: Set<string>): ValidationResult {
    const result = this.validateStage(level, internalDict);
    const errors = [...result.errors];
    const warnings = [...result.warnings];

    if (level.groups) {
      if (level.groups.length === 0) {
        errors.push(`Main Puzzle Level ${level.levelNumber || level.id} has 0 categories.`);
      }
    }

    if (errors.length > 0) return { status: 'ERRORS', errors, warnings };
    if (warnings.length > 0) return { status: 'WARNINGS', errors, warnings };
    return { status: 'OK', errors, warnings };
  }
}


