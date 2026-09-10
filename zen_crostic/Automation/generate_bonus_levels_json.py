#!/usr/bin/env python3
"""Convert the "Bonus Level" content CSV into the bonus_levels.json format.

Bonus (Idiom) levels differ from main-puzzle levels in two ways:

  * Every clue is illustrated with an icon instead of a text question, so
    clues carry a Picture (the answer word, also used as the icon name)
    rather than separate question/answer columns.
  * Both the main phrase and every clue answer are always fully encrypted
    (every letter hidden) - there is no partial-reveal mask syntax like the
    "Level V1" main-puzzle CSV supports (@/#/$).

Required columns: Level_Number, Phrase, Puzzle, then repeating
"Picture N"/"Puzzle N" pairs (N = 1, 2, 3, ...; a row may use fewer clue
slots than the header defines by leaving the trailing Picture/Puzzle N
cells blank).

The "Puzzle"/"Puzzle N" columns authored in the CSV are used only to
validate that every letter is masked with "_" and that punctuation/spaces
match the display text exactly - the actual phrase/answer JSON is always
the fully-encrypted form.

Each clue's "icon" is the title-cased Picture value (e.g. "JEANS" ->
"Jeans") to match the sprite naming convention in
assets/resources/sprites/crostics_clue_icons/. Every icon referenced here
must have a matching <IconName>.png in that folder - see the "Bonus puzzle
icons" note in CLAUDE.md.

The CSV has no room for the puzzle-level "author"/"desc" fields the runtime
schema supports (shown on the post-puzzle album/narration screen), so they
are emitted as empty strings. Fill them in by hand afterwards if the
content team supplies real copy.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict
from pathlib import Path


class ContentError(ValueError):
    pass


def find_header(rows: list[list[str]]) -> tuple[int, list[str]]:
    required = {"Level_Number", "Phrase", "Puzzle", "Picture 1", "Puzzle 1"}
    for index, row in enumerate(rows):
        if required.issubset({cell.strip() for cell in row}):
            return index, [cell.strip() for cell in row]
    raise ContentError(f"CSV is missing required headers: {sorted(required)}")


def encrypted(display: str, masked: str, row_number: int, field: str) -> dict:
    """Fully encrypt ``display``, validating it against the authored mask.

    Every alphabetic character must be masked with "_" in ``masked``; every
    other character (spaces, punctuation) must appear verbatim.
    """
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
    for char_index, (display_char, masked_char) in enumerate(zip(display, masked)):
        if display_char.isalpha() and display_char.isascii():
            if masked_char != "_":
                raise ContentError(
                    f"row {row_number}, {field} character {char_index + 1}: "
                    f"expected '_' to mask {display_char!r}, found {masked_char!r}"
                )
            phrase_chars.append("_")
        else:
            if display_char != masked_char:
                raise ContentError(
                    f"row {row_number}, {field} character {char_index + 1}: "
                    f"visible character {masked_char!r} does not match {display_char!r}"
                )
            phrase_chars.append(masked_char)

    answer = "".join(char.upper() for char in display if char.isalpha() and char.isascii())
    if not answer:
        raise ContentError(f"row {row_number}: {field} has no ASCII letters")

    return {
        "display": display,
        "phrase": "".join(phrase_chars),
        "answer": answer,
    }


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
            if name and (match := re.fullmatch(r"Picture (\d+)", name))
        }
    )
    if not clue_indexes:
        raise ContentError("CSV must contain at least one Picture N/Puzzle N clue pair")

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

        phrase = encrypted(row["Phrase"], row["Puzzle"], row_number, "Phrase")

        clues = []
        for index in clue_indexes:
            picture = (row.get(f"Picture {index}") or "").strip()
            clue_puzzle = (row.get(f"Puzzle {index}") or "").strip()
            if not picture:
                continue
            if not clue_puzzle:
                raise ContentError(f"row {row_number}: Picture {index} has no matching Puzzle {index}")
            clue = encrypted(picture, clue_puzzle, row_number, f"Picture {index}")
            clues.append({
                "question": "",
                **clue,
                "icon": picture.strip().capitalize(),
            })

        if not clues:
            raise ContentError(f"row {row_number}: no clues")

        puzzles[level] = {
            "phrase": phrase,
            "author": "",
            "desc": "",
            "clues": clues,
        }

    if not puzzles:
        raise ContentError("CSV contains no levels")

    expected = list(range(1, len(puzzles) + 1))
    actual = [int(level) for level in puzzles]
    if actual != expected:
        raise ContentError(f"levels must be contiguous and start at 1, found {actual}")
    return puzzles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("output_path", type=Path)
    args = parser.parse_args()
    try:
        puzzles = load_file(args.csv_path)
        args.output_path.parent.mkdir(parents=True, exist_ok=True)
        with args.output_path.open("w", encoding="utf-8") as handle:
            json.dump(puzzles, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        icons = sorted({clue["icon"] for puzzle in puzzles.values() for clue in puzzle["clues"]})
        print(f"generated {args.output_path} ({len(puzzles)} puzzles, {len(icons)} distinct icons)")
        print("icons required: " + ", ".join(icons))
    except (ContentError, OSError, csv.Error) as error:
        raise SystemExit(f"error: {error}")


if __name__ == "__main__":
    main()
