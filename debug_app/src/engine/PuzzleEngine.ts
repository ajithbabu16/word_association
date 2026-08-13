import type {
    PuzzleSession,
    PuzzleEngineTransition,
    PuzzleSolvedRow,
    PuzzleCellDefinition
} from "./PuzzleModels";
import { cloneSession } from "./PuzzleModels";

export class PuzzleEngine {
    static DEBUG_CHANNEL = "puzzle.engine";
    static ROW_DEBUG_CHANNEL = "puzzle.row";

    private isActiveSlot(session: PuzzleSession, slotIndex: number): boolean {
        return slotIndex >= 0 && slotIndex < session.activeSlots.length;
    }

    private areSlotsInSameRow(session: PuzzleSession, slotA: number, slotB: number): boolean {
        const cols = session.level.size.columns;
        return Math.floor(slotA / cols) === Math.floor(slotB / cols);
    }

    private logSwapRowState(session: PuzzleSession, fromSlot: number, toSlot: number, reason: string) {
        console.debug(`Swap state: ${reason}`, { fromSlot, toSlot });
    }

    private isRowReadyForLock(session: PuzzleSession, tileIds: string[], pictureCategoryKeys: Set<string>): boolean {
        // Mock implementation
        return true;
    }

    private assignHintColorForCategory(session: PuzzleSession, categoryKey: string) {
        // Mock implementation
    }

    private clearRevealedCategoryHintForCategory(session: PuzzleSession, categoryKey: string) {
        // Mock implementation
    }

    private resolveMergedReplacementTileId(session: PuzzleSession, row: PuzzleSolvedRow): string {
        // Use the anchor tile (last-placed = toSlot) as the picture card
        const anchorTileId = row.anchorSlotIndex !== undefined
            ? (session.activeSlots[row.anchorSlotIndex] ?? row.tileIds[0])
            : row.tileIds[0];
        const primaryTileId = anchorTileId;
        const tile = session.tilesById[primaryTileId];
        if (tile) {
            session.tilesById[primaryTileId] = {
                ...tile,
                word: row.category,
                isFormedPictureCard: true,
            };
        }
        return primaryTileId;
    }

    private areRegularCategoriesSolved(session: PuzzleSession): boolean {
        // Count how many categories are solved vs total regular categories
        const regularCategoryCount = session.level.categories - (session.level.extraCategory ? 1 : 0);
        let solvedRegular = 0;
        const solvedKeys = new Set(session.solvedRows.map(r => r.categoryKey));
        
        for (const key of solvedKeys) {
            // Find if this key is extra category
            const isExtra = session.level.extraCategoryKey === key;
            if (!isExtra) solvedRegular++;
        }
        return solvedRegular >= regularCategoryCount;
    }

    public swap(session: PuzzleSession, fromSlot: number, toSlot: number): PuzzleEngineTransition {
        if (fromSlot === toSlot) {
            console.debug("Swap ignored because origin and target match", { fromSlot, toSlot });
            return { session, effects: [] };
        }
        if (session.completed || session.failed) {
            console.debug("Swap ignored because session is terminal");
            return { session, effects: [] };
        }
        if (session.extraCategoryActive && !session.extraCategoryComplete && !this.areSlotsInSameRow(session, fromSlot, toSlot)) {
            console.debug("Swap ignored because extra-category mode only allows row movement");
            return { session, effects: [] };
        }

        const next = cloneSession(session);
        if (!this.isActiveSlot(next, fromSlot) || !this.isActiveSlot(next, toSlot)) {
            console.debug("Swap ignored because a slot is not active");
            return { session, effects: [] };
        }

        const fromTile = next.activeSlots[fromSlot];
        const toTile = next.activeSlots[toSlot];
        if (!fromTile || !toTile) {
            console.debug("Swap ignored because a tile is missing");
            return { session, effects: [] };
        }

        next.activeSlots[fromSlot] = toTile;
        next.activeSlots[toSlot] = fromTile;
        this.logSwapRowState(next, fromSlot, toSlot, "after_swap");
        next.moveCount += 1;
        next.lastHintPreview = null;
        if (next.movesRemaining !== null) {
            next.movesRemaining = Math.max(0, next.movesRemaining - 1);
        }

        const effects: PuzzleEngineTransition["effects"] = [{ type: "swap", fromSlot, toSlot }];
        if (!next.extraCategoryActive || next.extraCategoryComplete) {
            this.resolveRegularRows(next, effects, [toSlot, fromSlot]);
        }
        this.resolveExtraCategory(next, effects);
        this.resolveFailure(next, effects);

        return {
            session: next,
            effects,
        };
    }

    private isTileInCategory(session: PuzzleSession, tile: PuzzleCellDefinition, categoryKey: string): boolean {
        if (tile.categoryKey === categoryKey) return true;
        const targetCells = session.level.cells.filter(c => c.categoryKey === categoryKey);
        const tileWordClean = tile.word.trim().toUpperCase();
        return targetCells.some(c => c.word.trim().toUpperCase() === tileWordClean);
    }

    private resolveRegularRows(session: PuzzleSession, effects: PuzzleEngineTransition["effects"], preferredAnchorSlots: number[]): void {
        const rows = session.level.size.rows;
        const cols = session.level.size.columns;
        const lockedSlotSet = new Set(session.lockedSlotIndexes);
        const pictureCategoryKeys = new Set(
            session.level.cells
                .filter((cell) => cell.isPictureCategory)
                .map((cell) => cell.categoryKey),
        );
        console.info("Starting row resolution", { preferredAnchorSlots });

        // Loop until no more rows can be resolved in this turn.
        // Picture merges stop the loop (need tile-drop + re-render before next check).
        // Text row locks continue looping so chained completions (e.g. CALENDAR after VEGETABLES) always resolve.
        while (true) {
            const lockableRows: PuzzleSolvedRow[] = [];
            const mergeRows: Array<PuzzleSolvedRow & { anchorSlotIndex: number; }> = [];
            
            for (let rowIndex = rows - 1; rowIndex >= 0; rowIndex -= 1) {
                const tileIds: string[] = [];
                const slotIndexes: number[] = [];
                const rowWords: string[] = [];
                let valid = true;
                
                for (let colIndex = 0; colIndex < cols; colIndex += 1) {
                    const slotIndex = rowIndex * cols + colIndex;
                    if (lockedSlotSet.has(slotIndex)) {
                        valid = false;
                        break;
                    }
                    const tileId = session.activeSlots[slotIndex];
                    if (!tileId) {
                        valid = false;
                        break;
                    }
                    const tile = session.tilesById[tileId];
                    if (!tile) {
                        valid = false;
                        break;
                    }
                    tileIds.push(tileId);
                    slotIndexes.push(slotIndex);
                    rowWords.push(tile.word);
                }

                if (!valid || tileIds.length !== cols) {
                    continue;
                }

                // Check if all tiles in this row belong to a single matching categoryKey
                const rowTiles = tileIds.map(id => session.tilesById[id]!);
                let categoryKey = "";

                for (const t of rowTiles) {
                    const candidateKey = t.categoryKey;
                    if (rowTiles.every(tile => this.isTileInCategory(session, tile, candidateKey))) {
                        categoryKey = candidateKey;
                        break;
                    }
                }

                if (!categoryKey) {
                    continue;
                }
                const firstTile = session.tilesById[tileIds[0]];
                if (!firstTile) {
                    continue;
                }
                if (!pictureCategoryKeys.has(categoryKey) && !this.isRowReadyForLock(session, tileIds, pictureCategoryKeys)) {
                    continue;
                }

                const solvedRow: PuzzleSolvedRow = {
                    order: session.solvedRows.length + lockableRows.length + mergeRows.length,
                    category: session.level.categoryLabels[categoryKey] ?? firstTile.category,
                    categoryKey: categoryKey,
                    isPictureCategory: pictureCategoryKeys.has(categoryKey),
                    isExtraCategory: firstTile.isExtraCategory === true,
                    tileIds: tileIds.slice(),
                    slotIndexes: slotIndexes.slice(),
                    presentation: pictureCategoryKeys.has(categoryKey) ? "merged" : "locked",
                };

                if (pictureCategoryKeys.has(categoryKey)) {
                    const anchorCandidate = preferredAnchorSlots.find((slot) => slotIndexes.indexOf(slot) >= 0);
                    const anchorSlotIndex = anchorCandidate ?? slotIndexes[slotIndexes.length - 1];
                    mergeRows.push({ ...solvedRow, anchorSlotIndex });
                    break;
                } else {
                    lockableRows.push(solvedRow);
                    break;
                }
            }

            // Nothing resolved this pass – done
            if (lockableRows.length === 0 && mergeRows.length === 0) {
                break;
            }

            if (lockableRows.length > 0) {
                for (const row of lockableRows) {
                    session.solvedRows.push(row);
                    this.assignHintColorForCategory(session, row.categoryKey);
                    this.clearRevealedCategoryHintForCategory(session, row.categoryKey);
                    for (const slotIndex of row.slotIndexes) {
                        if (!lockedSlotSet.has(slotIndex)) {
                            session.lockedSlotIndexes.push(slotIndex);
                            lockedSlotSet.add(slotIndex);
                        }
                    }
                }
                effects.push({ type: "rows_locked", rows: lockableRows });
                // Continue loop – another row may now be complete
            }

            if (mergeRows.length > 0) {
                for (const row of mergeRows) {
                    session.solvedRows.push(row);
                    this.assignHintColorForCategory(session, row.categoryKey);
                    this.clearRevealedCategoryHintForCategory(session, row.categoryKey);
                    const replacementTileId = this.resolveMergedReplacementTileId(session, row);
                    for (const slotIndex of row.slotIndexes) {
                        if (slotIndex !== row.anchorSlotIndex) {
                            const tileIdToMerge = session.activeSlots[slotIndex];
                            if (tileIdToMerge) {
                                const tile = session.tilesById[tileIdToMerge];
                                if (tile) {
                                    session.tilesById[tileIdToMerge] = { ...tile, isMergingOut: true };
                                }
                            }
                        }
                    }
                    if (row.anchorSlotIndex !== undefined) {
                        session.activeSlots[row.anchorSlotIndex] = replacementTileId;
                    }
                }
                effects.push({ type: "picture_rows_merged", rows: mergeRows });
                // NOTE: collapseBoard is NOT called here intentionally.
                // The UI will call engine.collapse() after the merge animation completes.
                // STOP after picture merge.
                break;
            }
        }
    }

    /**
     * Called by the UI after the picture-merge animation has finished.
     * Collapses the board (tiles fall down) and refills from the queue.
     */
    public collapse(session: PuzzleSession): PuzzleEngineTransition {
        console.log("[PuzzleEngine.collapse] Initiating board collapse. Session active slots:", session.activeSlots);
        const next = cloneSession(session);
        const effects: PuzzleEngineTransition["effects"] = [];
        const refill = this.collapseBoard(next);
        console.log("[PuzzleEngine.collapse] collapseBoard result:", refill);
        if (refill.filledSlots.length > 0 || refill.spawnedSlotIndexes.length > 0) {
            effects.push({
                type: "board_refilled",
                filledSlots: refill.filledSlots,
                spawnedSlotIndexes: refill.spawnedSlotIndexes,
            });
        }
        // After collapsing, a chained text-row may now be complete (e.g. CALENDAR)
        console.log("[PuzzleEngine.collapse] Resolving regular rows after collapse...");
        this.resolveRegularRows(next, effects, []);
        this.resolveExtraCategory(next, effects);
        this.resolveFailure(next, effects);
        console.log("[PuzzleEngine.collapse] Finished collapse. Generated effects:", effects);
        return { session: next, effects };
    }

    private collapseBoard(session: PuzzleSession): { filledSlots: number[]; spawnedSlotIndexes: number[]; } {
        const rows = session.level.size.rows;
        const cols = session.level.size.columns;
        const filledSlots: number[] = [];
        const spawnedSlotIndexes: number[] = [];
        const lockedSlotSet = new Set(session.lockedSlotIndexes);
        console.log("[PuzzleEngine.collapseBoard] lockedSlotSet:", Array.from(lockedSlotSet));

        // Remove tiles that were merging out (they should disappear now that animation is over)
        for (let i = 0; i < session.activeSlots.length; i++) {
            const tileId = session.activeSlots[i];
            if (tileId) {
                const tile = session.tilesById[tileId];
                if (tile && tile.isMergingOut) {
                    session.activeSlots[i] = null;
                }
            }
        }

        // SPEC: Picture cards bubble to the TOP. Normal tiles fall to the BOTTOM. Nulls fall in between (which will be filled by queue tiles).
        // Process column by column.
        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            const unlockedRows: number[] = [];

            for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
                const slotIndex = (rowIndex * cols) + colIndex;
                if (!lockedSlotSet.has(slotIndex)) {
                    unlockedRows.push(rowIndex);
                }
            }
            
            // Gather existing non-null tiles from top to bottom (both normal and picture cards)
            const existingTiles: string[] = [];
            
            for (const rowIndex of unlockedRows) {
                const tileId = session.activeSlots[(rowIndex * cols) + colIndex];
                if (tileId) {
                    existingTiles.push(tileId);
                }
            }
            console.log(`[PuzzleEngine.collapseBoard] Col ${colIndex} unlockedRows:`, unlockedRows, "existingTiles:", existingTiles);
 
            // Fill: Empty slots (nulls) bubble to the top, active tiles fall to the bottom
            const totalUnlocked = unlockedRows.length;
            const nullCount = totalUnlocked - existingTiles.length;
 
            for (let i = 0; i < unlockedRows.length; i++) {
                const rowIndex = unlockedRows[i];
                const targetIndex = (rowIndex * cols) + colIndex;
                const previousTile = session.activeSlots[targetIndex];
 
                let nextTile: string | null = null;
                if (i < nullCount) {
                    nextTile = null;            // Top rows become empty (to be filled by queue)
                } else {
                    nextTile = existingTiles[i - nullCount]; // Bottom rows get the existing active tiles
                }
 
                session.activeSlots[targetIndex] = nextTile;
 
                if (nextTile && nextTile !== previousTile) {
                    filledSlots.push(targetIndex);
                }
            }
        }

        // SPEC: Next sequence tiles drop into TOP empty slots from behind the HUD line.
        // Fill row-by-row (top-to-bottom), left-to-right.
        console.log("[PuzzleEngine.collapseBoard] Refilling empty slots from queue. Queue size:", session.queue.length);
        for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            for (let colIndex = 0; colIndex < cols; colIndex += 1) {
                const slotIndex = (rowIndex * cols) + colIndex;

                if (lockedSlotSet.has(slotIndex) || session.activeSlots[slotIndex] !== null) {
                    continue;
                }

                const nextTile = session.queue.shift() ?? null;
                console.log(`[PuzzleEngine.collapseBoard] Refilling slotIndex ${slotIndex} with tile ${nextTile}`);
                session.activeSlots[slotIndex] = nextTile;

                if (nextTile) {
                    filledSlots.push(slotIndex);
                    spawnedSlotIndexes.push(slotIndex);
                }
            }
        }

        return { filledSlots, spawnedSlotIndexes };
    }

    private resolveExtraCategory(session: PuzzleSession, effects: PuzzleEngineTransition["effects"]): void {
        if (!session.level.extraCategory) {
            if (this.areRegularCategoriesSolved(session)) {
                session.completed = true;
                effects.push({ type: "session_completed" });
            }
            return;
        }

        if (!session.extraCategoryActive && this.areRegularCategoriesSolved(session)) {
            session.extraCategoryActive = true;
            session.lockedSlotIndexes = [];
            session.hintRevealedTileIds = session.hintRevealedTileIds.filter((tileId) => {
                const tile = session.tilesById[tileId];
                return !tile || !tile.isExtraCategory;
            });
            effects.push({ type: "extra_category_activated", categoryKey: session.level.extraCategoryKey });
            return;
        }

        if (!session.extraCategoryActive || session.extraCategoryComplete) {
            return;
        }

        const cols = session.level.size.columns;
        const rows = session.level.size.rows;
        let complete = true;
        // SPEC: Master category is formed in the LEFTMOST column (column 0)
        for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const tileId = session.activeSlots[(rowIndex * cols) + 0];
            const tile = tileId ? session.tilesById[tileId] : null;
            if (!tile || tile.isExtraCategory !== true) {
                complete = false;
                break;
            }
        }

        if (complete) {
            session.extraCategoryComplete = true;
            session.completed = true;
            effects.push({ type: "extra_category_completed", categoryKey: session.level.extraCategoryKey });
            effects.push({ type: "session_completed" });
        }
    }

    private resolveFailure(session: PuzzleSession, effects: PuzzleEngineTransition["effects"]): void {
        if (session.completed) {
            return;
        }
        if (session.movesRemaining !== null && session.movesRemaining <= 0) {
            session.failed = true;
            effects.push({ type: "session_failed", reason: "moves_exhausted" });
            return;
        }
        if (session.timerRemainingMs !== null && session.timerRemainingMs <= 0) {
            session.failed = true;
            effects.push({ type: "session_failed", reason: "timer_expired" });
        }
    }
}
