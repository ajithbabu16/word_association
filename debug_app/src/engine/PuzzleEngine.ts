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
        // Mock implementation for picture category merge
        // Just return the first tile ID for now or a special merged ID
        return row.tileIds[0];
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
            this.resolveRegularRows(next, effects, [fromSlot, toSlot]);
        }
        this.resolveExtraCategory(next, effects);
        this.resolveFailure(next, effects);

        return {
            session: next,
            effects,
        };
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

        while (true) {
            const lockableRows: PuzzleSolvedRow[] = [];
            const mergeRows: Array<PuzzleSolvedRow & { anchorSlotIndex: number; }> = [];
            
            for (let rowIndex = rows - 1; rowIndex >= 0; rowIndex -= 1) {
                const tileIds: string[] = [];
                const slotIndexes: number[] = [];
                const rowWords: string[] = [];
                let categoryKey = "";
                let valid = true;
                let invalidReason = "";
                
                for (let colIndex = 0; colIndex < cols; colIndex += 1) {
                    const slotIndex = rowIndex * cols + colIndex;
                    if (lockedSlotSet.has(slotIndex)) {
                        valid = false;
                        invalidReason = `locked_slot:${slotIndex}`;
                        break;
                    }
                    const tileId = session.activeSlots[slotIndex];
                    if (!tileId) {
                        valid = false;
                        invalidReason = `empty_slot:${slotIndex}`;
                        break;
                    }
                    const tile = session.tilesById[tileId];
                    if (!tile) {
                        valid = false;
                        invalidReason = `missing_tile:${tileId}`;
                        break;
                    }
                    if (!categoryKey) {
                        categoryKey = tile.categoryKey;
                    } else if (tile.categoryKey !== categoryKey) {
                        valid = false;
                        invalidReason = `mixed_category:${categoryKey}|${tile.categoryKey}@${slotIndex}`;
                        break;
                    }
                    tileIds.push(tileId);
                    slotIndexes.push(slotIndex);
                    rowWords.push(tile.word);
                }

                if (!valid || !categoryKey) {
                    continue;
                }
                const firstTile = session.tilesById[tileIds[0]];
                if (!firstTile) {
                    continue;
                }
                if (!firstTile.isPictureCategory && !this.isRowReadyForLock(session, tileIds, pictureCategoryKeys)) {
                    continue;
                }

                const solvedRow: PuzzleSolvedRow = {
                    order: session.solvedRows.length + lockableRows.length + mergeRows.length,
                    category: firstTile.category,
                    categoryKey: firstTile.categoryKey,
                    isPictureCategory: firstTile.isPictureCategory,
                    isExtraCategory: firstTile.isExtraCategory === true,
                    tileIds: tileIds.slice(),
                    slotIndexes: slotIndexes.slice(),
                    presentation: firstTile.isPictureCategory ? "merged" : "locked",
                };

                if (firstTile.isPictureCategory) {
                    const anchorCandidate = preferredAnchorSlots.find((slot) => slotIndexes.indexOf(slot) >= 0);
                    const anchorSlotIndex = anchorCandidate ?? slotIndexes[slotIndexes.length - 1];
                    mergeRows.push({
                        ...solvedRow,
                        anchorSlotIndex,
                    });
                    break;
                } else {
                    lockableRows.push(solvedRow);
                    break;
                }
            }

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
            }

            if (mergeRows.length > 0) {
                for (const row of mergeRows) {
                    session.solvedRows.push(row);
                    this.assignHintColorForCategory(session, row.categoryKey);
                    this.clearRevealedCategoryHintForCategory(session, row.categoryKey);
                    const replacementTileId = this.resolveMergedReplacementTileId(session, row);
                    for (const slotIndex of row.slotIndexes) {
                        if (slotIndex !== row.anchorSlotIndex) {
                            session.activeSlots[slotIndex] = null;
                        }
                    }
                    if (row.anchorSlotIndex !== undefined) {
                        session.activeSlots[row.anchorSlotIndex] = replacementTileId;
                    }
                }
                effects.push({ type: "picture_rows_merged", rows: mergeRows });

                const refill = this.collapseBoard(session);
                if (refill.filledSlots.length > 0 || refill.spawnedSlotIndexes.length > 0) {
                    effects.push({
                        type: "board_refilled",
                        filledSlots: refill.filledSlots,
                        spawnedSlotIndexes: refill.spawnedSlotIndexes,
                    });
                }
            }
        }
    }

    private collapseBoard(session: PuzzleSession): { filledSlots: number[]; spawnedSlotIndexes: number[]; } {
        const rows = session.level.size.rows;
        const cols = session.level.size.columns;
        const filledSlots: number[] = [];
        const spawnedSlotIndexes: number[] = [];
        const lockedSlotSet = new Set(session.lockedSlotIndexes);

        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            const unlockedRows: number[] = [];

            for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
                const slotIndex = (rowIndex * cols) + colIndex;
                if (!lockedSlotSet.has(slotIndex)) {
                    unlockedRows.push(rowIndex);
                }
            }

            const compacted: string[] = [];

            for (const rowIndex of unlockedRows) {
                const tileId = session.activeSlots[(rowIndex * cols) + colIndex];
                if (tileId) {
                    compacted.push(tileId);
                }
            }

            for (const rowIndex of unlockedRows) {
                const targetIndex = (rowIndex * cols) + colIndex;
                const previousTile = session.activeSlots[targetIndex];
                const nextTile = compacted.shift() ?? null;

                session.activeSlots[targetIndex] = nextTile;

                if (nextTile && nextTile !== previousTile) {
                    filledSlots.push(targetIndex);
                }
            }
        }

        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            for (let rowIndex = rows - 1; rowIndex >= 0; rowIndex -= 1) {
                const slotIndex = (rowIndex * cols) + colIndex;

                if (lockedSlotSet.has(slotIndex) || session.activeSlots[slotIndex] !== null) {
                    continue;
                }

                const nextTile = session.queue.shift() ?? null;
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
        for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const tileId = session.activeSlots[(rowIndex * cols) + Math.max(0, cols - 1)];
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
