export type PuzzleLibraryKind = "daily" | "default" | string;

export interface PuzzleGridSize {
    rows: number;
    columns: number;
    visibleCount: number;
}

export interface PuzzleCellDefinition {
    cellIndex: number;
    word: string;
    category: string;
    categoryKey: string;
    isExtraCategory: boolean;
    isPictureCategory: boolean;
    isFormedPictureCard?: boolean;
    isMergingOut?: boolean;
}

export interface PuzzleSequenceDefinition {
    name: string;
    data: number[];
}

export interface PuzzleLevelIdentity {
    id: number;
    content: string;
    themeName: string;
    levelNumber: number;
    stageNumber: number;
}

export interface PuzzleLevelDefinition {
    identity: PuzzleLevelIdentity;
    library: PuzzleLibraryKind;
    difficulty: string;
    size: PuzzleGridSize;
    categories: number;
    extraCategory: string;
    extraCategoryKey: string;
    cells: PuzzleCellDefinition[];
    sequences: PuzzleSequenceDefinition[];
    categoryCounts: Record<string, number>;
    categoryLabels: Record<string, string>;
}

// Session Models
export interface PuzzleSolvedRow {
    order: number;
    category: string;
    categoryKey: string;
    isPictureCategory: boolean;
    isExtraCategory: boolean;
    tileIds: string[];
    slotIndexes: number[];
    presentation: "merged" | "locked";
    anchorSlotIndex?: number;
}

export interface PuzzleSession {
    level: PuzzleLevelDefinition;
    activeSlots: (string | null)[]; // length = size.columns * size.rows
    tilesById: Record<string, PuzzleCellDefinition>;
    queue: (string | null)[];
    lockedSlotIndexes: number[];
    solvedRows: PuzzleSolvedRow[];
    moveCount: number;
    movesRemaining: number | null;
    timerRemainingMs: number | null;
    completed: boolean;
    failed: boolean;
    extraCategoryActive: boolean;
    extraCategoryComplete: boolean;
    hintRevealedTileIds: string[];
    lastHintPreview: any | null;
}

export type PuzzleEngineEffect =
    | { type: "swap"; fromSlot: number; toSlot: number }
    | { type: "rows_locked"; rows: PuzzleSolvedRow[] }
    | { type: "picture_rows_merged"; rows: PuzzleSolvedRow[] }
    | { type: "board_refilled"; filledSlots: number[]; spawnedSlotIndexes: number[] }
    | { type: "extra_category_activated"; categoryKey: string }
    | { type: "extra_category_completed"; categoryKey: string }
    | { type: "session_completed" }
    | { type: "session_failed"; reason: string };

export interface PuzzleEngineTransition {
    session: PuzzleSession;
    effects: PuzzleEngineEffect[];
}

export function cloneSession(session: PuzzleSession): PuzzleSession {
    return {
        ...session,
        activeSlots: [...session.activeSlots],
        tilesById: { ...session.tilesById }, // Shallow copy assuming tiles don't mutate
        queue: [...session.queue],
        lockedSlotIndexes: [...session.lockedSlotIndexes],
        solvedRows: session.solvedRows.map(r => ({ ...r, tileIds: [...r.tileIds], slotIndexes: [...r.slotIndexes] })),
        hintRevealedTileIds: [...session.hintRevealedTileIds],
    };
}

export function normalizePuzzleCategoryKey(category: string): string {
    return category.trim().toUpperCase();
}

export function parsePuzzleGridSize(sizeStr: string): PuzzleGridSize {
    const [rows, cols] = sizeStr.split("x").map(Number);
    return {
        rows,
        columns: cols,
        visibleCount: rows * cols,
    };
}

export function inferPuzzleLibraryKind(content: string): PuzzleLibraryKind {
    return content || "default";
}

// Raw Data Models (from JSON)
export interface PuzzleRawGroup {
    category: string;
    words: string[];
    picture?: boolean;
}

export interface PuzzleRawCell {
    word: string;
    category: string;
    isExtraCategory?: boolean;
    isPictureCategory?: boolean;
}

export interface PuzzleRawExtraCategoryBlock {
    label: string;
    words: string[];
}

export interface PuzzleRawLevel {
    id: number;
    levelNumber?: number;
    stageNumber?: number;
    size?: string;
    difficulty?: string;
    content?: string;
    themeName?: string;
    extraCategory?: string | PuzzleRawExtraCategoryBlock;
    groups?: PuzzleRawGroup[];
    cells?: PuzzleRawCell[];
    sequences: { name: string; data: number[] }[];
}

export interface PuzzleRawLevelDefaults {
    size?: string;
    difficulty?: string;
}

export interface PuzzleRawTheme {
    name?: string;
    levelNumber: number;
    levels: PuzzleRawLevel[];
}

export interface PuzzleRawLibrary {
    kind?: PuzzleLibraryKind;
    version?: number;
    defaults?: PuzzleRawLevelDefaults;
    levels?: PuzzleRawLevel[];
    themes?: PuzzleRawTheme[];
}
