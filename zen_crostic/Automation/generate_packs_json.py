#!/usr/bin/env python3
"""Convert the Packs content CSV into deterministic Cocos bundle data files."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict
from pathlib import Path


THEME_PATTERN = re.compile(r"^(?P<name>.+?)\s+-\s+(?P<number>\d+)$")
MASKS = {"_", "@", "#"}


class ContentError(ValueError):
    pass


def find_header(rows: list[list[str]]) -> int:
    required = {"Theme", "Complete Phrase", "Puzzle", "About phrase"}
    for index, row in enumerate(rows):
        if required.issubset({cell.strip() for cell in row}):
            return index
    raise ContentError(f"CSV is missing required headers: {sorted(required)}")


def convert_puzzle(complete: str, masked: str, row_number: int) -> dict:
    if len(complete) != len(masked):
        raise ContentError(
            f"row {row_number}: Complete Phrase and Puzzle lengths differ "
            f"({len(complete)} != {len(masked)})"
        )

    phrase: list[str] = []
    answer: list[str] = []
    locks1: list[int] = []
    locks2: list[int] = []
    blank_index = 0

    for char_index, (complete_char, masked_char) in enumerate(zip(complete, masked)):
        if masked_char in MASKS:
            phrase.append("_")
            answer.append(complete_char)
            if masked_char == "@":
                locks1.append(blank_index)
            elif masked_char == "#":
                locks2.append(blank_index)
            blank_index += 1
        else:
            if complete_char.casefold() != masked_char.casefold():
                raise ContentError(
                    f"row {row_number}, character {char_index + 1}: visible character "
                    f"{masked_char!r} does not match {complete_char!r}"
                )
            phrase.append(masked_char)

    if not answer:
        raise ContentError(f"row {row_number}: puzzle has no missing letters")

    return {
        "phrase": "".join(phrase),
        "answer": "".join(answer),
        "locks1": locks1,
        "locks2": locks2,
    }


def load_packs(csv_path: Path) -> list[tuple[str, OrderedDict[str, dict]]]:
    if csv_path.suffix.lower() in ['.xlsx', '.xls']:
        import pandas as pd
        df = pd.read_excel(csv_path)
        rows = [df.columns.values.tolist()] + df.fillna("").values.tolist()
        rows = [[str(cell) for cell in row] for row in rows]
    else:
        with csv_path.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.reader(handle))

    header_index = find_header(rows)
    header = [cell.strip() for cell in rows[header_index]]
    groups: OrderedDict[str, OrderedDict[str, dict]] = OrderedDict()

    for row_number, values in enumerate(rows[header_index + 1 :], header_index + 2):
        if not any(cell.strip() for cell in values):
            continue
        values += [""] * (len(header) - len(values))
        row = dict(zip(header, values))
        raw_theme = row["Theme"].strip()
        match = THEME_PATTERN.fullmatch(raw_theme)
        if not match:
            # Fallback for themes without trailing "- number"
            theme_name = raw_theme
            puzzle_number = len(groups.get(theme_name, {})) + 1
        else:
            theme_name = match.group("name").strip()
            puzzle_number = int(match.group("number"))

        puzzles = groups.setdefault(theme_name, OrderedDict())
        puzzle_key = str(puzzle_number)

        puzzle = convert_puzzle(
            row["Complete Phrase"], row["Puzzle"], row_number
        )
        puzzle["author"] = row.get("About phrase", "").strip()
        puzzle["desc"] = ""
        puzzles[puzzle_key] = puzzle

    if not groups:
        raise ContentError("File contains no Packs puzzles")

    result: list[tuple[str, OrderedDict[str, dict]]] = []
    for theme_name, puzzles in groups.items():
        result.append((theme_name, puzzles))
    return result


def write_packs(packs: list[tuple[str, OrderedDict[str, dict]]], output_dir: Path) -> None:
    for event_id, (theme_name, puzzles) in enumerate(packs, 1):
        data_dir = output_dir / f"packs_{event_id}_v1" / "Data"
        data_dir.mkdir(parents=True, exist_ok=True)
        output_path = data_dir / "data.json"
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump({"sceneName": theme_name, "puzzles": puzzles}, handle, indent=2)
            handle.write("\n")
        print(f"generated {output_path} ({theme_name}, {len(puzzles)} puzzles)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate packs_N_v1/Data/data.json files from Packs CSV or XLSX."
    )
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("output_path", nargs="?", type=Path, default=None)
    parser.add_argument("--output-dir", required=False, type=Path, default=None)
    args = parser.parse_args()

    try:
        packs = load_packs(args.csv_path)
        if args.output_path:
            args.output_path.parent.mkdir(parents=True, exist_ok=True)
            combined_packs = {}
            for idx, (theme_name, puzzles) in enumerate(packs, 1):
                combined_packs[f"pack_{idx}"] = {"sceneName": theme_name, "puzzles": puzzles}
            with args.output_path.open("w", encoding="utf-8") as handle:
                json.dump(combined_packs, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            print(f"generated {args.output_path}")
        elif args.output_dir:
            write_packs(packs, args.output_dir)
        else:
            parser.error("provide output_path or --output-dir")
    except (ContentError, OSError, csv.Error) as error:
        raise SystemExit(f"error: {error}")


if __name__ == "__main__":
    main()
