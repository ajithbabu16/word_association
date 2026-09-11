#!/usr/bin/env python3
"""Generate Packs resource JSON from authored CSV or XLSX.

The CSV has columns:
Theme, Author, Phrase, Puzzle, Q1, A1, Puzzle 1, Q2, A2, Puzzle 2, ...
(and optional extra columns like Total words in quote, Total words).

This script:
1. Parses Packs CSV or XLSX files
2. Converts phrase and clue masks (_ = blank, @ = locks1, # = locks2, $ = cloak)
3. Keeps clues with answer even if question is empty ("")
4. Outputs JSON format: {"sceneName": theme, "puzzles": {"1": {...}, "2": {...}}}
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
    """Find header row containing required Packs columns."""
    required = {"Theme", "Phrase", "Puzzle", "Q1", "A1"}
    for index, row in enumerate(rows):
        normalized = {cell.strip() if cell else "" for cell in row}
        if required.issubset(normalized):
            return index, [cell.strip() if cell else "" for cell in row]
    raise ContentError(f"CSV is missing required headers: {sorted(required)}")


def convert_text(display: str, masked: str, row_number: int, field: str) -> dict:
    """Convert display text and masked puzzle text into game text structure."""
    display = display.strip()
    masked = masked.strip()
    if not display:
        raise ContentError(f"row {row_number}: {field} is empty")
    if not masked or masked.startswith('#ERROR') or masked.startswith('#REF'):
        raise ContentError(f"row {row_number}: Puzzle for {field} contains error or is empty: {masked!r}")
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


def convert_clues(row: dict[str, str], clue_indexes: list[int], row_number: int, level_num: str = "") -> list[dict]:
    """Convert QN/AN/Puzzle N clue triples into clue objects."""
    clues = []
    lvl_lbl = f"Level {level_num}" if level_num else f"row {row_number}"

    for index in clue_indexes:
        question = (row.get(f"Q{index}") or row.get(f"Q {index}") or "").strip()
        answer = (row.get(f"A{index}") or row.get(f"A {index}") or "").strip()
        masked = (row.get(f"Puzzle {index}") or row.get(f"Puzzle{index}") or "").strip()

        if not question and not answer:
            continue

        if not answer:
            print(f"Warning: {lvl_lbl} Q{index} has question {question!r} but answer A{index} is missing; skipping clue")
            continue

        if not question:
            print(f"Warning: {lvl_lbl} clue {index} has answer {answer!r} but question Q{index} is empty; preserving clue with empty question")

        if not masked or masked.startswith(("#ERROR", "#REF")):
            masked = "".join("_" if char.isascii() and char.isalpha() else char for char in answer)

        clues.append({"question": question, **convert_text(answer, masked, row_number, f"A{index}")})

    if not clues:
        raise ContentError(f"{lvl_lbl}: no valid clues found")
    return clues


def load_pack_csv(path: Path) -> dict:
    """Load CSV or XLSX file and extract Packs level data."""
    if path.suffix.lower() in ['.xlsx', '.xls']:
        import pandas as pd
        df = pd.read_excel(path)
        rows = [df.columns.values.tolist()] + df.fillna("").values.tolist()
        rows = [[str(cell) for cell in row] for row in rows]
    else:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.reader(handle))

    header_index, header = find_header(rows)

    clue_indexes = sorted(
        {
            int(match.group(1))
            for name in header
            if name and (match := re.fullmatch(r"Q\s*(\d+)", name))
        }
    )

    puzzles: OrderedDict[str, dict] = OrderedDict()
    theme_name = ""

    for row_number, values in enumerate(rows[header_index + 1:], header_index + 2):
        if not any(cell.strip() for cell in values):
            continue
        values = values + [""] * (len(header) - len(values))
        row = dict(zip(header, values))

        row_theme = row.get("Theme", "").strip()
        if row_theme and not theme_name:
            theme_name = row_theme

        level_key = str(len(puzzles) + 1)
        author = row.get("Author", "").strip()
        phrase = convert_text(row["Phrase"], row["Puzzle"], row_number, "Phrase")
        clues = convert_clues(row, clue_indexes, row_number, level_num=level_key)

        puzzle_entry: dict = {
            "phrase": phrase,
            "clues": clues,
            "solv": 0.0,
        }
        if author:
            puzzle_entry["author"] = author

        puzzles[level_key] = puzzle_entry

    if not puzzles:
        raise ContentError("CSV contains no valid pack puzzles")

    return {
        "sceneName": theme_name if theme_name else "Pack",
        "puzzles": puzzles,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path, help="Packs Level CSV or XLSX")
    parser.add_argument("output_path", type=Path, nargs="?", help="Output JSON file or target directory")
    parser.add_argument("--pack-id", type=int, default=1, help="Pack bundle ID (default: 1)")
    parser.add_argument("--packs-output", type=Path, help="Base directory for asset bundles")
    args = parser.parse_args()

    try:
        pack_data = load_pack_csv(args.csv_path)

        if args.output_path:
            out_path = args.output_path
            if out_path.suffix.lower() == ".json" or not out_path.is_dir():
                out_path.parent.mkdir(parents=True, exist_ok=True)
                target_file = out_path
            else:
                out_path.mkdir(parents=True, exist_ok=True)
                target_file = out_path / "packs_data.json"

            with target_file.open("w", encoding="utf-8") as handle:
                json.dump(pack_data, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"Generated {target_file} ({len(pack_data['puzzles'])} puzzles)")

        if args.packs_output:
            bundle_dir = args.packs_output / f"packs_{args.pack_id}_v1" / "Data"
            bundle_dir.mkdir(parents=True, exist_ok=True)
            bundle_file = bundle_dir / "data.json"
            with bundle_file.open("w", encoding="utf-8") as handle:
                json.dump(pack_data, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"Generated {bundle_file} ({len(pack_data['puzzles'])} puzzles)")

        if not args.output_path and not args.packs_output:
            print(json.dumps(pack_data, ensure_ascii=False, indent=2))

    except (ContentError, OSError, csv.Error) as error:
        raise SystemExit(f"error: {error}")


if __name__ == "__main__":
    main()
