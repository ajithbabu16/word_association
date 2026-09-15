#!/usr/bin/env python3
"""Convert Packs content CSV into Cocos bundle data files and create a downloadable zip package."""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from collections import OrderedDict
from pathlib import Path


THEME_PATTERN = re.compile(r"^(?P<name>.+?)\s+-\s+(?P<number>\d+)$")
MASKS = {"_", "@", "#"}
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CSV_PATH = SCRIPT_DIR / "packslevel.csv"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "output"
DEFAULT_ZIP_PATH = SCRIPT_DIR / "packs_output.zip"


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
    if not csv_path.exists():
        raise ContentError(f"CSV file not found: {csv_path}")

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
            raise ContentError(f"row {row_number}: invalid Theme value {raw_theme!r}")

        theme_name = match.group("name").strip()
        puzzle_number = int(match.group("number"))
        puzzles = groups.setdefault(theme_name, OrderedDict())
        puzzle_key = str(puzzle_number)
        if puzzle_key in puzzles:
            raise ContentError(f"row {row_number}: duplicate {theme_name} puzzle {puzzle_number}")

        puzzle = convert_puzzle(
            row["Complete Phrase"], row["Puzzle"], row_number
        )
        puzzle["author"] = row["About phrase"].strip()
        puzzle["desc"] = ""
        puzzles[puzzle_key] = puzzle

    if not groups:
        raise ContentError("CSV contains no Packs puzzles")

    result: list[tuple[str, OrderedDict[str, dict]]] = []
    for theme_name, puzzles in groups.items():
        actual = sorted(int(key) for key in puzzles)
        expected = list(range(1, 51))
        if actual != expected:
            raise ContentError(
                f"{theme_name}: expected puzzles 1..50, found {actual}"
            )
        ordered = OrderedDict((str(number), puzzles[str(number)]) for number in expected)
        result.append((theme_name, ordered))
    return result


def write_packs(packs: list[tuple[str, OrderedDict[str, dict]]], output_dir: Path) -> list[Path]:
    generated_files: list[Path] = []
    for event_id, (theme_name, puzzles) in enumerate(packs, 1):
        data_dir = output_dir / f"packs_{event_id}_v1" / "Data"
        data_dir.mkdir(parents=True, exist_ok=True)
        output_path = data_dir / "data.json"
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump({"sceneName": theme_name, "puzzles": puzzles}, handle, indent=2)
            handle.write("\n")
        generated_files.append(output_path)
        print(f"Generated: {output_path} ({theme_name}, {len(puzzles)} puzzles)")
    return generated_files


def make_zip_archive(output_dir: Path, zip_path: Path) -> Path:
    base_name = zip_path.with_suffix("")
    archive_path = shutil.make_archive(
        base_name=str(base_name),
        format="zip",
        root_dir=output_dir,
    )
    final_zip = Path(archive_path)
    print(f"\nDownloadable ZIP created successfully: {final_zip}")
    return final_zip


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert Packs CSV into JSON bundle files and create a downloadable ZIP."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Path to input CSV file (default: {DEFAULT_CSV_PATH})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Path to output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--zip-path",
        type=Path,
        default=DEFAULT_ZIP_PATH,
        help=f"Path for output zip archive (default: {DEFAULT_ZIP_PATH})",
    )
    parser.add_argument(
        "--no-zip",
        action="store_true",
        help="Skip creating zip archive",
    )

    args = parser.parse_args()

    print(f"Processing CSV: {args.csv}")
    print(f"Output Directory: {args.output_dir}")

    try:
        packs = load_packs(args.csv)
        write_packs(packs, args.output_dir)

        if not args.no_zip:
            make_zip_archive(args.output_dir, args.zip_path)

        print("\nAll packs successfully converted and saved!")
    except (ContentError, OSError, csv.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
