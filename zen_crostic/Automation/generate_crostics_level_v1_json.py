#!/usr/bin/env python3
"""Convert the authored Crostics "Level V1" content CSV into the main-puzzle JSON format.

Unlike ``generate_crostics_json.py`` (which auto-encrypts every letter of a
plain quote), this CSV already authors the exact reveal pattern for the
phrase and every clue via a "Puzzle" column that mirrors its own
"Complete"/answer text character-for-character:

    _   normal missing letter
    @   missing letter, recorded in locks1 (single lock)
    #   missing letter, recorded in locks2 (double lock)
    $   missing letter, recorded in cloak
    any other character must match the source text (case-insensitively)
        and is kept exactly as authored (its own case) in the runtime phrase

Required columns: Level_Number, Phrase, Puzzle, then repeating QN/AN/Puzzle N
triples (N = 1, 2, 3, ...) for each clue.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict
from pathlib import Path

MASKS = {"_", "@", "#", "$"}


class ContentError(ValueError):
    pass


def find_header(rows: list[list[str]]) -> tuple[int, list[str]]:
    required = {"Level_Number", "Phrase", "Puzzle", "Q1", "A1"}
    for index, row in enumerate(rows):
        if required.issubset({cell.strip() for cell in row}):
            return index, [cell.strip() for cell in row]
    raise ContentError(f"CSV is missing required headers: {sorted(required)}")

def convert_text(display: str, masked: str, row_number: int, field: str) -> dict:
    display = display.strip()
    masked = masked.strip()
    if not display:
        raise ContentError(f"row {row_number}: {field} is empty")
    if not masked:
        raise ContentError(f"row {row_number}: Puzzle for {field} is empty")
    if len(display) != len(masked):
        raise ContentError(
            f"row {row_number}: {field} and its Puzzle length differ "
            f"({len(display)} != {len(masked)}): {display!r} vs {masked!r}"
        )

    phrase_chars: list[str] = []
    locks1: list[int] = []
    locks2: list[int] = []
    cloak: list[int] = []
    blank_index = 0

    for char_index, (display_char, masked_char) in enumerate(zip(display, masked)):
        if masked_char in MASKS:
            phrase_chars.append("_")
            if masked_char == "@":
                locks1.append(blank_index)
            elif masked_char == "#":
                locks2.append(blank_index)
            elif masked_char == "$":
                cloak.append(blank_index)
            blank_index += 1
        else:
            if display_char.casefold() != masked_char.casefold():
                raise ContentError(
                    f"row {row_number}, {field} character {char_index + 1}: "
                    f"visible character {masked_char!r} does not match {display_char!r}"
                )
            phrase_chars.append(masked_char)

    answer = "".join(char.upper() for char in display if char.isalpha() and char.isascii())
    if not answer:
        raise ContentError(f"row {row_number}: {field} has no ASCII letters")

    result: dict = {
        "display": display,
        "phrase": "".join(phrase_chars),
        "answer": answer,
    }
    if locks1:
        result["locks1"] = locks1
    if locks2:
        result["locks2"] = locks2
    if cloak:
        result["cloak"] = cloak
    return result


def load_file(path: Path) -> OrderedDict[str, dict]:
    if path.suffix.lower() in ['.xlsx', '.xls']:
        import pandas as pd
        df = pd.read_excel(path)
        raw_rows = [df.columns.values.tolist()] + df.fillna("").values.tolist()
        raw_rows = [[str(cell) for cell in row] for row in raw_rows]
    else:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            raw_rows = list(csv.reader(handle))

    header_index, header = find_header(raw_rows)

    clue_indexes = sorted(
        {
            int(match.group(1))
            for name in header
            if name and (match := re.fullmatch(r"Q(\d+)", name))
        }
    )
    if not clue_indexes:
        raise ContentError("CSV must contain at least one QN/AN/Puzzle N clue triple")

    puzzles: OrderedDict[str, dict] = OrderedDict()
    for row_number, values in enumerate(raw_rows[header_index + 1:], header_index + 2):
        if not any(cell.strip() for cell in values):
            continue
        values = values + [""] * (len(header) - len(values))
        row = dict(zip(header, values))

        level = row.get("Level_Number", "").strip()
        if not level.isdigit() or int(level) < 1:
            continue
        if level in puzzles:
            raise ContentError(f"row {row_number}: duplicate level {level}")

        phrase = convert_text(row["Phrase"], row["Puzzle"], row_number, "Phrase")

        clues = []
        for index in clue_indexes:
            question = (row.get(f"Q{index}") or row.get(f"Q {index}") or "").strip()
            clue_answer = (row.get(f"A{index}") or row.get(f"A {index}") or "").strip()
            clue_puzzle = (row.get(f"Puzzle {index}") or row.get(f"Puzzle{index}") or "").strip()
            if not question and not clue_answer:
                continue
            if not clue_answer:
                print(f"Warning: Level {level} Q{index} has question {question!r} but answer A{index} is missing; skipping clue")
                continue
            if not question:
                print(f"Warning: Level {level} clue {index} has answer {clue_answer!r} but question Q{index} is empty; preserving clue with empty question")
            if not clue_puzzle or clue_puzzle.startswith(("#ERROR", "#REF")):
                clue_puzzle = "".join("_" if char.isascii() and char.isalpha() else char for char in clue_answer)
            clue = convert_text(clue_answer, clue_puzzle, row_number, f"A{index}")
            clues.append({"question": question, **clue})

        if not clues:
            raise ContentError(f"row {row_number}: no clues")

        puzzles[level] = {"phrase": phrase, "clues": clues}

    if not puzzles:
        raise ContentError("CSV contains no levels")

    expected = list(range(1, len(puzzles) + 1))
    actual = [int(level) for level in puzzles]
    if actual != expected:
        raise ContentError(f"levels must be contiguous and start at 1, found {actual}")
    return puzzles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("output_path", type=Path)
    args = parser.parse_args()
    try:
        puzzles = load_file(args.csv_path)
        args.output_path.parent.mkdir(parents=True, exist_ok=True)
        with args.output_path.open("w", encoding="utf-8") as handle:
            json.dump(puzzles, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(f"generated {args.output_path} ({len(puzzles)} puzzles)")
    except (ContentError, OSError, csv.Error) as error:
        raise SystemExit(f"error: {error}")


if __name__ == "__main__":
    main()
