#!/usr/bin/env python3
"""Generate Daily Puzzle resource JSON and Packs bundle JSON from authored CSVs.

The CSV has columns: Date, Story title, Phrase, Puzzle, then repeating QN/AN/Puzzle N
triples (N = 1, 2, 3, ...) for each clue.

This script:
1. Groups puzzles by month based on the Date column
2. Generates one JSON file per month at: YYYY_MM/data/level.json
3. Each puzzle is keyed by date string (YYYYMMDD format)
4. Uses the same mask/encryption format as Level V1
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict, defaultdict
from pathlib import Path
from datetime import datetime
import calendar

MASKS = {"_", "@", "#", "$"}


class ContentError(ValueError):
    pass


def find_header(rows: list[list[str]]) -> tuple[int, list[str]]:
    required = {"Date", "Phrase", "Puzzle", "Q1", "A1"}
    for index, row in enumerate(rows):
        if required.issubset({cell.strip() if cell else "" for cell in row}):
            return index, [cell.strip() if cell else "" for cell in row]
    raise ContentError(f"CSV is missing required headers: {sorted(required)}")


def convert_text(display: str, masked: str, row_number: int, field: str) -> dict:
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


def convert_clues(row: dict[str, str], clue_indexes: list[int], row_number: int, level_str: str = "") -> list[dict]:
    clues = []
    lvl_lbl = f"Level {level_str}" if level_str else f"row {row_number}"
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
        raise ContentError(f"{lvl_lbl}: no valid clues")
    return clues


def load_csv(path: Path) -> dict[str, dict]:
    """Load CSV or XLSX and group puzzles by month."""
    if path.suffix.lower() in ['.xlsx', '.xls']:
        import pandas as pd
        df = pd.read_excel(path)
        raw_rows = [df.columns.values.tolist()] + df.fillna("").values.tolist()
        raw_rows = [[str(cell) for cell in raw_rows_row] for raw_rows_row in raw_rows]
    else:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            raw_rows = list(csv.reader(handle))

    header_index, header = find_header(raw_rows)

    clue_indexes = sorted(int(match.group(1)) for name in header
                          if name and (match := re.fullmatch(r"Q(\d+)", name)))

    # Group puzzles by month (YYYYMM key)
    monthly_puzzles: dict[str, dict] = defaultdict(lambda: {"puzzles": OrderedDict(), "story_titles": set()})
    for row_number, values in enumerate(raw_rows[header_index + 1:], header_index + 2):
        if not any(cell.strip() if cell else False for cell in values):
            continue
        values = values + [""] * (len(header) - len(values))
        row = dict(zip(header, values))

        # Parse date
        date_value = row.get("Date", "").strip()
        if not date_value:
            continue

        for date_format in ("%Y%m%d", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y"):
            try:
                puzzle_date = datetime.strptime(date_value, date_format)
                break
            except ValueError:
                pass
        else:
            raise ContentError(f"row {row_number}: invalid date: {date_value!r}")

        # Format date keys
        date_key = puzzle_date.strftime("%Y%m%d")  # e.g., "20260901"
        month_key = puzzle_date.strftime("%Y_%m")  # e.g., "2026_09"

        # Story title - track for month-level sceneName
        story_title = (row.get("Story title") or "").strip()
        if story_title:
            monthly_puzzles[month_key]["story_titles"].add(story_title)

        phrase = convert_text(row["Phrase"], row["Puzzle"], row_number, "Phrase")
        clues = convert_clues(row, clue_indexes, row_number)

        # Use the shared Crostics contract so Daily and Packs render clue rows.
        puzzle_entry = {
            "phrase": phrase,
            "clues": clues,
            "solv": 0.0,  # Default solve rate, can be updated later
        }

        monthly_puzzles[month_key]["puzzles"][date_key] = puzzle_entry

    return monthly_puzzles


def load_pack_csv(path: Path) -> dict:
    if path.suffix.lower() in ['.xlsx', '.xls']:
        import pandas as pd
        df = pd.read_excel(path)
        rows = [df.columns.values.tolist()] + df.fillna("").values.tolist()
        rows = [[str(cell) for cell in row] for row in rows]
    else:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.reader(handle))
    header_index, header = next(
        (i, [c.strip() for c in row]) for i, row in enumerate(rows)
        if {"Theme", "Phrase", "Puzzle"}.issubset({c.strip() for c in row})
    )
    clue_indexes = sorted(int(match.group(1)) for name in header
                          if name and (match := re.fullmatch(r"Q(\d+)", name)))
    puzzles = OrderedDict()
    for row_number, values in enumerate(rows[header_index + 1:], header_index + 2):
        if not any(cell.strip() for cell in values):
            continue
        values = values + [""] * (len(header) - len(values))
        row = dict(zip(header, values))
        theme = row["Theme"].strip()
        phrase = convert_text(row["Phrase"], row["Puzzle"], row_number, "Phrase")
        clues = convert_clues(row, clue_indexes, row_number)
        puzzles[str(row_number - header_index)] = {
            "phrase": phrase,
            "clues": clues,
            "solv": 0.0
        }
    return {"sceneName": theme if 'theme' in locals() else "Pack", "puzzles": puzzles}


def add_month_metadata(monthly_data: dict[str, dict]) -> None:
    for month_key, data in monthly_data.items():
        titles = sorted(data.pop("story_titles"))
        scene_name = titles[0] if titles else "Daily Puzzle"
        data["sceneName"] = scene_name
        data.update({
            "hud_bg_light": "F5F5F5",
            "hud_bg_dark": "2B2B2B"
        })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path, nargs="?", help="Daily Puzzle CSV or XLSX")
    parser.add_argument("output_path", type=Path, nargs="?", help="Output file or directory")
    parser.add_argument("--packs-csv", type=Path, help="Packs Level CSV")
    parser.add_argument("--packs-output", type=Path, help="assets/asset_bundles/packs")
    parser.add_argument("--pack-id", type=int, default=1)
    parser.add_argument("--allow-partial-months", action="store_true")
    args = parser.parse_args()

    try:
        if not args.csv_path and not args.packs_csv:
            parser.error("provide daily inputs, Packs inputs, or both")

        monthly_data = load_csv(args.csv_path) if args.csv_path else {}
        add_month_metadata(monthly_data)

        if args.output_path and (args.output_path.suffix.lower() == '.json' or not args.output_path.is_dir()):
            args.output_path.parent.mkdir(parents=True, exist_ok=True)
            output_json = {}
            for month_key, data in monthly_data.items():
                output_json[month_key] = data
            with args.output_path.open("w", encoding="utf-8") as handle:
                json.dump(output_json if len(output_json) > 1 else list(monthly_data.values())[0], handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"Generated {args.output_path}")
            return

        if args.output_path:
            output_dir = args.output_path
            output_dir.mkdir(parents=True, exist_ok=True)

            total_puzzles = 0
            for month_key, data in monthly_data.items():
                year, month = map(int, month_key.split("_"))
                expected = calendar.monthrange(year, month)[1]
                if len(data["puzzles"]) != expected and not args.allow_partial_months:
                    print(f"Warning {month_key}: expected {expected} daily puzzles, found {len(data['puzzles'])}")
                month_dir = output_dir / month_key
                data_dir = month_dir / "data"
                data_dir.mkdir(parents=True, exist_ok=True)

                output_file = data_dir / "level.json"
                with output_file.open("w", encoding="utf-8") as handle:
                    json.dump(data, handle, ensure_ascii=False, indent=2)
                    handle.write("\n")

                puzzle_count = len(data["puzzles"])
                total_puzzles += puzzle_count
                print(f"Generated {output_file} ({puzzle_count} puzzles)")

        if args.packs_csv:
            pack_data = load_pack_csv(args.packs_csv)
            output_path = args.packs_output / f"packs_{args.pack_id}_v1" / "Data" / "data.json"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with output_path.open("w", encoding="utf-8") as handle:
                json.dump(pack_data, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"Generated {output_path} ({len(pack_data['puzzles'])} puzzles)")

        print(f"\nTotal: {len(monthly_data)} months, {total_puzzles} puzzles")

    except (ContentError, OSError, csv.Error) as error:
        raise SystemExit(f"error: {error}")


if __name__ == "__main__":
    main()
