import sys
import csv
import json
import string

def extract_missing_letters(complete_phrase, puzzle, level_no=None):
    """
    Compare each word in the complete phrase with the puzzle.

    For every character in the puzzle that is a blank marker:
      - '_' indicates a normal blank.
      - '@' indicates a blank locked with lock1.
      - '#' indicates a blank locked with lock2.
      - '$' indicates a blank locked with cloak.

    The function extracts the corresponding letters from the complete phrase
    (only for blank positions that are not punctuation) to build the answer and
    records the blank's index (0-indexed) into arrays based on the marker.

    Returns:
        answer (str): Concatenated missing letters from blank positions (excluding punctuation).
        lock1 (list): List of indices for blanks marked with '@'.
        lock2 (list): List of indices for blanks marked with '#'.
        cloak (list): List of indices for blanks marked with '$'.
    """
    missing_letters = []
    lock1 = []
    lock2 = []
    cloak = []
    blank_counter = 0

    complete_words = complete_phrase.split()
    puzzle_words = puzzle.split()

    if len(complete_words) != len(puzzle_words):
        print(f"Warning for level {level_no}: The number of words in the complete phrase ({len(complete_words)}) "
              f"and puzzle ({len(puzzle_words)}) do not match!")

    for comp_word, puzz_word in zip(complete_words, puzzle_words):
        for i in range(min(len(comp_word), len(puzz_word))):
            marker = puzz_word[i]
            if marker in ['_', '@', '#', '$']:
                # Only add the character if it is not punctuation.
                if comp_word[i] not in string.punctuation:
                    missing_letters.append(comp_word[i])
                if marker == '@':
                    lock1.append(blank_counter)
                elif marker == '#':
                    lock2.append(blank_counter)
                elif marker == '$':
                    cloak.append(blank_counter)
                blank_counter += 1
    return "".join(missing_letters), lock1, lock2, cloak

def csv_to_json(csv_filename, json_filename):
    levels = {}
    phrases = {}
    with open(csv_filename, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            # Expected columns:
            # Level No., Complete Phrase, Puzzle, Author, About author, Hard level tagging, solve by %
            if not row or len(row) < 7:
                continue  # skip malformed rows
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

            # Extract answer and lock positions using the original puzzle (with @, # and $)
            answer, locks1, locks2, cloak = extract_missing_letters(complete_phrase, puzzle, level_no)
            # Replace '@', '#' and '$' with '_' in the puzzle for final output.
            modified_puzzle = puzzle.replace('@', '_').replace('#', '_').replace('$', '_')

            entry = {
                "phrase": modified_puzzle,
                "answer": answer,
                "solv": solv,
                "author": author,
                "desc": desc
            }
            # Only add the lock keys if non-empty.
            if locks1:
                entry["locks1"] = locks1
            if locks2:
                entry["locks2"] = locks2
            if cloak:
                entry["cloak"] = cloak
            # Add the hard flag only for hard-tagged levels.
            if hard_tag:
                entry["hard"] = True

            levels[level_no] = entry
            phrases[level_no] = complete_phrase

    with open(json_filename, 'w', encoding='utf-8') as jsonfile:
        json.dump(levels, jsonfile, indent=4, ensure_ascii=False)
    print(f"JSON data successfully written to {json_filename}")

    phrases_filename = json_filename.replace('.json', '_phrases.json')
    with open(phrases_filename, 'w', encoding='utf-8') as phrasefile:
        json.dump(phrases, phrasefile, indent=4, ensure_ascii=False)
    print(f"Phrases JSON successfully written to {phrases_filename}")

if __name__ == "__main__":
    csv_filename = sys.argv[1] if len(sys.argv) > 1 else "csv/main_levels_dup_removed.csv"
    json_filename = sys.argv[2] if len(sys.argv) > 2 else "generated/level_hard.json"
    csv_to_json(csv_filename, json_filename)
