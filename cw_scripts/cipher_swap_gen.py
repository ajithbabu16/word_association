import sys
import csv
import json
import re
import xml.etree.ElementTree as ET
import zipfile

from hard_gen import extract_missing_letters

# Generates cipher_swap_levels.json for the Cipher Swap feature from the
# "Cipher swap" sheet of the Codewords Database workbook. The sheet's
# "Solve by %" column is a fraction (1.0 == 100%), unlike the main-level CSVs.

XLSX_PATH = sys.argv[1] if len(sys.argv) > 1 else "/Users/shubham/Downloads/Codewords_ Database.xlsx"
SHEET_NAME = "Cipher swap"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def col_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref).group()
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def extract_sheet_rows(xlsx_path, sheet_name):
    z = zipfile.ZipFile(xlsx_path)
    workbook = z.read("xl/workbook.xml").decode()
    m = re.search(rf'<sheet[^>]*name="{re.escape(sheet_name)}"[^>]*r:id="(rId\d+)"', workbook)
    if not m:
        raise ValueError(f'Sheet "{sheet_name}" not found in {xlsx_path}')
    rels = z.read("xl/_rels/workbook.xml.rels").decode()
    target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))[m.group(1)]

    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        sst_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        t_tag = "{%s}t" % NS["m"]
        for si in sst_root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(t_tag)))

    root = ET.fromstring(z.read("xl/" + target.lstrip("/")))
    rows = []
    for row in root.find("m:sheetData", NS).findall("m:row", NS):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            if c.get("t") == "s" and v is not None:
                val = shared[int(v.text)]
            elif v is not None:
                val = v.text
            else:
                val = ""
            cells[col_index(c.get("r"))] = val
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i, "") for i in range(width)])
    return rows


def sheet_to_json(json_filename, csv_dump_filename=None):
    rows = extract_sheet_rows(XLSX_PATH, SHEET_NAME)

    if csv_dump_filename:
        with open(csv_dump_filename, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(rows)
        print(f"Sheet CSV dumped to {csv_dump_filename}")

    levels = {}
    phrases = {}
    for row in rows:
        # Columns: Level No., Complete Phrase, Puzzle, Author, About author, Solve by %
        if not row or len(row) < 6:
            continue
        level_str = row[0].strip()
        try:
            level_no = str(int(float(level_str)))  # sheet stores numbers as "1.0"
        except ValueError:
            continue  # header / notes rows
        complete_phrase = row[1].strip()
        puzzle = row[2].strip()
        author = row[3].strip()
        desc = row[4].strip() if row[4] else ""
        try:
            solv = round(float(row[5].strip()) * 100, 2)  # fraction -> percent
        except ValueError:
            solv = 0.0

        answer, locks1, locks2, cloak = extract_missing_letters(complete_phrase, puzzle, level_no)
        modified_puzzle = puzzle.replace("@", "_").replace("#", "_").replace("$", "_")

        entry = {
            "phrase": modified_puzzle,
            "answer": answer,
            "solv": solv,
            "author": author,
            "desc": desc
        }
        if locks1:
            entry["locks1"] = locks1
        if locks2:
            entry["locks2"] = locks2
        if cloak:
            entry["cloak"] = cloak

        levels[level_no] = entry
        phrases[level_no] = complete_phrase

    with open(json_filename, "w", encoding="utf-8") as jsonfile:
        json.dump(levels, jsonfile, indent=4, ensure_ascii=False)
    print(f"JSON data successfully written to {json_filename} ({len(levels)} levels)")

    phrases_filename = json_filename.replace(".json", "_phrases.json")
    with open(phrases_filename, "w", encoding="utf-8") as phrasefile:
        json.dump(phrases, phrasefile, indent=4, ensure_ascii=False)
    print(f"Phrases JSON successfully written to {phrases_filename}")


if __name__ == "__main__":
    sheet_to_json(sys.argv[2] if len(sys.argv) > 2 else "generated/cipher_swap_levels.json", csv_dump_filename="csv/cipher_swap.csv")
