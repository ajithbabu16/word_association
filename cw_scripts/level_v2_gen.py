import sys
import csv
import json

from hard_gen import extract_missing_letters

# Builds level_v2.json for the content_v2 experiment: a copy of the shipped
# level_v1.json with only levels PATCH_START..PATCH_END replaced by fresh
# content from the CSV. Levels outside that range stay byte-identical.

PATCH_START = 21
PATCH_END = 120

BASE_LEVELS_JSON = "/Users/Shared/Code/codewords/assets/resources/datas/level/level_v1.json"


def csv_to_entries(csv_filename):
    levels = {}
    phrases = {}
    with open(csv_filename, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            # Expected columns:
            # Level No., Complete Phrase, Puzzle, Author, About author, Hard level tagging, solve by %
            if not row or len(row) < 7:
                continue
            level_no = row[0].strip()
            if not level_no.isdigit():
                continue  # skip header / notes rows
            complete_phrase = row[1].strip()
            puzzle = row[2].strip()
            author = row[3].strip()
            desc = row[4].strip() if row[4] else ""
            hard_tag = row[5].strip().lower() == "hard"
            solv_str = row[6].strip().replace("%", "")
            try:
                solv = float(solv_str)
            except ValueError:
                solv = 0.0

            answer, locks1, locks2, cloak = extract_missing_letters(complete_phrase, puzzle, level_no)
            modified_puzzle = puzzle.replace('@', '_').replace('#', '_').replace('$', '_')

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
            if hard_tag:
                entry["hard"] = True

            levels[level_no] = entry
            phrases[level_no] = complete_phrase
    return levels, phrases


def build_level_v2(csv_filename, json_filename):
    new_levels, new_phrases = csv_to_entries(csv_filename)

    with open(BASE_LEVELS_JSON, encoding='utf-8') as f:
        levels = json.load(f)

    patched = []
    for n in range(PATCH_START, PATCH_END + 1):
        key = str(n)
        if key not in new_levels:
            print(f"Warning: level {key} missing from CSV, keeping v1 entry")
            continue
        if levels[key] != new_levels[key]:
            patched.append(n)
        levels[key] = new_levels[key]

    with open(json_filename, 'w', encoding='utf-8') as jsonfile:
        json.dump(levels, jsonfile, indent=4, ensure_ascii=False)
    print(f"JSON data successfully written to {json_filename} ({len(patched)} levels changed vs v1)")

    phrases_filename = json_filename.replace('.json', '_phrases.json')
    patched_phrases = {str(n): new_phrases[str(n)] for n in range(PATCH_START, PATCH_END + 1) if str(n) in new_phrases}
    with open(phrases_filename, 'w', encoding='utf-8') as phrasefile:
        json.dump(patched_phrases, phrasefile, indent=4, ensure_ascii=False)
    print(f"Phrases JSON successfully written to {phrases_filename}")


if __name__ == "__main__":
    build_level_v2("csv/main_levels_dup_removed.csv", "generated/level_v2.json")
