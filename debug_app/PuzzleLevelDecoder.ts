import {
    PuzzleCellDefinition,
    PuzzleGridSize,
    PuzzleLevelDefinition,
    PuzzleLibraryKind,
    PuzzleRawCell,
    PuzzleRawExtraCategoryBlock,
    PuzzleRawGroup,
    PuzzleRawLevel,
    PuzzleRawLevelDefaults,
    PuzzleRawLibrary,
    PuzzleRawTheme,
    PuzzleSequenceDefinition,
    inferPuzzleLibraryKind,
    normalizePuzzleCategoryKey,
    parsePuzzleGridSize,
} from "./PuzzleContentModels";
import { getSharedGameLogger } from "../../../framework/services/debug/GameLogger";
import { DAILY_PUZZLE_RELEASE_DATE } from "../config/PuzzleFeatureConfig";

/**
 * Resolved per-level context. Built by merging library-level defaults and
 * theme-level overrides on top of the raw level. All shape-specific branching
 * happens while building this context; `decodeLevel` below is shape-agnostic.
 */
interface LevelContext {
    library: PuzzleLibraryKind;
    content: string;
    themeName: string;
    levelNumber: number;
    stageNumber: number;
    difficulty: string;
    size: string;
}

// Returns "YYYY-MM-DD" for (releaseDate + offsetDays).
function dateByOffset(releaseDateStr: string, offsetDays: number): string {
    const [y, m, d] = releaseDateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d + offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export class PuzzleLevelDecoder {
    /**
     * Universal entry point. Accepts either the new wrapper format or the
     * legacy flat array of raw levels, and returns a flat list of decoded
     * level definitions. Invalid levels are skipped with a debug log so a
     * single bad entry can never take down the whole library.
     */
    decodeAssetSafe(asset: unknown, fallbackKind: PuzzleLibraryKind = "default"): PuzzleLevelDefinition[] {
        const decoded: PuzzleLevelDefinition[] = [];
        for (const [rawLevel, context] of this.iterateAsset(asset, fallbackKind)) {
            try {
                decoded.push(this.decodeLevel(rawLevel, context));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                getSharedGameLogger().debug("puzzle.flow", `Skipping invalid level ${rawLevel.id}`, {
                    reason: message,
                });
            }
        }
        return decoded;
    }

    /**
     * Legacy entry retained for call sites that already hold a flat array of
     * raw levels (cached snapshots, remote responses). Thin wrapper around the
     * universal entry.
     */
    decodeManySafe(rawLevels: PuzzleRawLevel[], fallbackKind: PuzzleLibraryKind = "default"): PuzzleLevelDefinition[] {
        return this.decodeAssetSafe(rawLevels, fallbackKind);
    }

    // ---------------------------------------------------------------------
    // Shape detection
    // ---------------------------------------------------------------------

    private iterateAsset(asset: unknown, fallbackKind: PuzzleLibraryKind): Array<[PuzzleRawLevel, LevelContext]> {
        if (Array.isArray(asset)) {
            return (asset as PuzzleRawLevel[]).map((rawLevel) => [rawLevel, this.buildLegacyContext(rawLevel, fallbackKind)]);
        }

        if (this.isWrapper(asset)) {
            return this.iterateWrapper(asset, fallbackKind);
        }

        throw new Error("Puzzle library asset must be a wrapper object or a flat array of raw levels.");
    }

    private isWrapper(asset: unknown): asset is PuzzleRawLibrary {
        if (asset === null || typeof asset !== "object" || Array.isArray(asset)) {
            return false;
        }
        const candidate = asset as PuzzleRawLibrary;
        return Array.isArray(candidate.levels) || Array.isArray(candidate.themes);
    }

    private iterateWrapper(library: PuzzleRawLibrary, fallbackKind: PuzzleLibraryKind): Array<[PuzzleRawLevel, LevelContext]> {
        const kind: PuzzleLibraryKind = library.kind ?? fallbackKind;
        const defaults: PuzzleRawLevelDefaults = library.defaults ?? {};
        const pairs: Array<[PuzzleRawLevel, LevelContext]> = [];

        if (library.levels) {
            for (const rawLevel of library.levels) {
                pairs.push([rawLevel, this.buildFlatContext(rawLevel, kind, defaults)]);
            }
        }

        if (library.themes) {
            for (const theme of library.themes) {
                for (const rawLevel of theme.levels) {
                    pairs.push([rawLevel, this.buildThemedContext(rawLevel, theme, kind, defaults)]);
                }
            }
        }

        return pairs;
    }

    // ---------------------------------------------------------------------
    // Context builders (one per shape variant)
    // ---------------------------------------------------------------------

    private buildLegacyContext(rawLevel: PuzzleRawLevel, fallbackKind: PuzzleLibraryKind): LevelContext {
        const content = rawLevel.content ?? "";
        const library = content ? inferPuzzleLibraryKind(content) : fallbackKind;
        const levelNumber = rawLevel.levelNumber ?? 0;
        return {
            library,
            content,
            themeName: rawLevel.themeName || this.dailyThemeName(library, levelNumber),
            levelNumber,
            stageNumber: rawLevel.stageNumber ?? 0,
            difficulty: this.require(rawLevel.difficulty, `Level ${rawLevel.id} is missing difficulty`),
            size: this.require(rawLevel.size, `Level ${rawLevel.id} is missing size`),
        };
    }

    private buildFlatContext(
        rawLevel: PuzzleRawLevel,
        kind: PuzzleLibraryKind,
        defaults: PuzzleRawLevelDefaults,
    ): LevelContext {
        const levelNumber = rawLevel.levelNumber ?? 0;
        return {
            library: kind,
            content: rawLevel.content ?? kind,
            themeName: rawLevel.themeName || this.dailyThemeName(kind, levelNumber),
            levelNumber,
            stageNumber: rawLevel.stageNumber ?? 0,
            difficulty: this.require(
                rawLevel.difficulty ?? defaults.difficulty,
                `Level ${rawLevel.id} is missing difficulty`,
            ),
            size: this.require(
                rawLevel.size ?? defaults.size,
                `Level ${rawLevel.id} is missing size`,
            ),
        };
    }

    private buildThemedContext(
        rawLevel: PuzzleRawLevel,
        theme: PuzzleRawTheme,
        kind: PuzzleLibraryKind,
        defaults: PuzzleRawLevelDefaults,
    ): LevelContext {
        const levelNumber = rawLevel.levelNumber ?? theme.levelNumber;
        return {
            library: kind,
            content: rawLevel.content ?? kind,
            themeName: rawLevel.themeName || theme.name || this.dailyThemeName(kind, levelNumber),
            levelNumber,
            stageNumber: rawLevel.stageNumber ?? 0,
            difficulty: this.require(
                rawLevel.difficulty ?? defaults.difficulty,
                `Level ${rawLevel.id} is missing difficulty`,
            ),
            size: this.require(
                rawLevel.size ?? defaults.size,
                `Level ${rawLevel.id} is missing size`,
            ),
        };
    }

    // ---------------------------------------------------------------------
    // Returns "YYYY-MM-DD" for a daily level by its 1-based levelNumber.
    // Level 1 = DAILY_PUZZLE_RELEASE_DATE, level 2 = release + 1 day, etc.
    // Returns "" for non-daily libraries so existing behaviour is unchanged.
    private dailyThemeName(library: PuzzleLibraryKind, levelNumber: number): string {
        if (library !== "daily" || levelNumber < 1) return "";
        return dateByOffset(DAILY_PUZZLE_RELEASE_DATE, levelNumber - 1);
    }

    // Core level decoding — shape-agnostic, runs against a resolved context
    // ---------------------------------------------------------------------

    private decodeLevel(rawLevel: PuzzleRawLevel, context: LevelContext): PuzzleLevelDefinition {
        const size = parsePuzzleGridSize(context.size);

        const cells = this.decodeCells(rawLevel);
        const extraCategoryLabel = this.resolveExtraCategoryLabel(rawLevel);
        this.applyExtraCategoryFlags(cells, rawLevel, extraCategoryLabel);

        const sequences = rawLevel.sequences.map((sequence): PuzzleSequenceDefinition => {
            return this.decodeSequence(sequence, cells.length, size, rawLevel.id);
        });

        const categoryCounts: Record<string, number> = {};
        const categoryLabels: Record<string, string> = {};
        for (const cell of cells) {
            categoryCounts[cell.categoryKey] = (categoryCounts[cell.categoryKey] ?? 0) + 1;
            categoryLabels[cell.categoryKey] = cell.category;
        }

        this.validateExtraCategory(cells, extraCategoryLabel, size, rawLevel.id);

        return {
            identity: {
                id: rawLevel.id,
                content: context.content,
                themeName: context.themeName,
                levelNumber: context.levelNumber,
                stageNumber: context.stageNumber,
            },
            library: context.library,
            difficulty: context.difficulty,
            size,
            categories: Object.keys(categoryCounts).length,
            extraCategory: extraCategoryLabel,
            extraCategoryKey: normalizePuzzleCategoryKey(extraCategoryLabel),
            cells,
            sequences,
            categoryCounts,
            categoryLabels,
        };
    }

    // ---------------------------------------------------------------------
    // Cells: accepts either `groups` (new) or `cells` (legacy)
    // ---------------------------------------------------------------------

    private decodeCells(rawLevel: PuzzleRawLevel): PuzzleCellDefinition[] {
        if (rawLevel.groups && rawLevel.groups.length > 0) {
            return this.flattenGroups(rawLevel.groups);
        }
        if (rawLevel.cells && rawLevel.cells.length > 0) {
            return this.decodeLegacyCells(rawLevel.cells);
        }
        throw new Error(`Level ${rawLevel.id} has neither groups nor cells`);
    }

    private flattenGroups(groups: PuzzleRawGroup[]): PuzzleCellDefinition[] {
        const cells: PuzzleCellDefinition[] = [];
        for (const group of groups) {
            for (const word of group.words) {
                cells.push({
                    cellIndex: cells.length,
                    word,
                    category: group.category,
                    categoryKey: normalizePuzzleCategoryKey(group.category),
                    isExtraCategory: false,
                    isPictureCategory: group.picture === true,
                });
            }
        }
        return cells;
    }

    private decodeLegacyCells(rawCells: PuzzleRawCell[]): PuzzleCellDefinition[] {
        return rawCells.map((cell, index): PuzzleCellDefinition => ({
            cellIndex: index,
            word: cell.word,
            category: cell.category,
            categoryKey: normalizePuzzleCategoryKey(cell.category),
            isExtraCategory: cell.isExtraCategory === true,
            isPictureCategory: cell.isPictureCategory === true,
        }));
    }

    // ---------------------------------------------------------------------
    // Extra category: the new block owns both the label and the member
    // words; legacy has a separate label + per-cell flags. We normalise both
    // into the same decoded representation.
    // ---------------------------------------------------------------------

    private resolveExtraCategoryLabel(rawLevel: PuzzleRawLevel): string {
        const value = rawLevel.extraCategory;
        if (value === undefined || value === null) {
            return "";
        }
        if (typeof value === "string") {
            return value.trim();
        }
        return value.label?.trim() ?? "";
    }

    private applyExtraCategoryFlags(
        cells: PuzzleCellDefinition[],
        rawLevel: PuzzleRawLevel,
        label: string,
    ): void {
        if (!label) {
            return;
        }

        const block = this.asExtraCategoryBlock(rawLevel.extraCategory);
        if (!block) {
            // Legacy shape — flags are already baked into cells by decodeLegacyCells.
            return;
        }

        const targetWords = new Set(block.words.map((word) => word.trim()));
        let matched = 0;
        for (const cell of cells) {
            if (targetWords.has(cell.word.trim())) {
                cell.isExtraCategory = true;
                matched += 1;
            }
        }

        if (matched !== block.words.length) {
            throw new Error(
                `Extra category ${label} lists ${block.words.length} words but only ${matched} matched cells in level ${rawLevel.id}`,
            );
        }
    }

    private asExtraCategoryBlock(
        value: string | PuzzleRawExtraCategoryBlock | undefined,
    ): PuzzleRawExtraCategoryBlock | null {
        if (value && typeof value === "object" && Array.isArray((value as PuzzleRawExtraCategoryBlock).words)) {
            return value as PuzzleRawExtraCategoryBlock;
        }
        return null;
    }

    private validateExtraCategory(
        cells: PuzzleCellDefinition[],
        label: string,
        size: PuzzleGridSize,
        levelId: number,
    ): void {
        const extraCategoryCellCount = cells.filter((cell) => cell.isExtraCategory).length;
        if (label) {
            if (extraCategoryCellCount !== size.rows) {
                throw new Error(
                    `Extra category ${label} must mark exactly ${size.rows} cells for level ${levelId}`,
                );
            }
        } else if (extraCategoryCellCount > 0) {
            throw new Error(`Level ${levelId} marks extra-category cells without an extraCategory label`);
        }
    }

    // ---------------------------------------------------------------------
    // Sequences
    // ---------------------------------------------------------------------

    private decodeSequence(
        sequence: { name: string; data: number[] },
        cellCount: number,
        size: PuzzleGridSize,
        levelId: number,
    ): PuzzleSequenceDefinition {
        const normalizedData = sequence.data.slice();
        for (const cellIndex of normalizedData) {
            if (cellIndex < 0 || cellIndex >= cellCount) {
                throw new Error(
                    `Sequence ${sequence.name} contains invalid cell index ${cellIndex} for level ${levelId}`,
                );
            }
        }

        if (normalizedData.length < size.visibleCount) {
            const usedCellIndexes = new Set(normalizedData);
            for (let cellIndex = 0; cellIndex < cellCount && normalizedData.length < size.visibleCount; cellIndex += 1) {
                if (!usedCellIndexes.has(cellIndex)) {
                    normalizedData.push(cellIndex);
                    usedCellIndexes.add(cellIndex);
                }
            }
        }

        if (normalizedData.length < size.visibleCount) {
            throw new Error(`Sequence ${sequence.name} is shorter than visible board for level ${levelId}`);
        }

        return {
            name: sequence.name,
            data: normalizedData,
        };
    }

    // ---------------------------------------------------------------------
    // Utility
    // ---------------------------------------------------------------------

    private require<T>(value: T | undefined | null, message: string): T {
        if (value === undefined || value === null || value === "") {
            throw new Error(message);
        }
        return value;
    }
}
