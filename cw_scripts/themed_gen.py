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
    
    The function extracts the corresponding letters from the complete phrase
    (only for blank positions that are not punctuation) to build the answer and
    records the blank's index (0-indexed) into two arrays based on the marker.
    
    If the number of words in the complete phrase and puzzle do not match,
    a warning including the level number is printed.
    
    Returns:
        answer (str): Concatenated missing letters from blank positions (excluding punctuation).
        lock1 (list): List of indices for blanks marked with '@'.
        lock2 (list): List of indices for blanks marked with '#'.
    """
    missing_letters = []
    lock1 = []
    lock2 = []
    wordSpace = []
    blank_counter = 0

    complete_words = complete_phrase.split()
    puzzle_words = puzzle.split()
    
    
    for comp_word, puzz_word in zip(complete_words, puzzle_words):
        if(int(level_no) < 10):
             print("Comparing words->" + comp_word + " : " + puzz_word)
        for i in range(min(len(comp_word), len(puzz_word))):
            marker = puzz_word[i]
            if marker in ['_', '@', '#', '*']:
                # Only add the character if it is not punctuation.
                if(int(level_no) < 10):
                     print("Adding word space at index:2->" + level_no, marker)
                if marker == '*':
                    wordSpace.append(blank_counter)
                elif comp_word[i] not in string.punctuation:
                    missing_letters.append(comp_word[i])
                if marker == '@':
                    lock1.append(blank_counter)
                elif marker == '#':
                    lock2.append(blank_counter)
                blank_counter += 1
    return "".join(missing_letters), lock1, lock2, wordSpace

def csv_to_json(csv_filename, json_filename):
    levels = {}
    phrases = {}
    with open(csv_filename, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            # Expected columns: Level No., Theme Name, Complete Phrases, Puzzle, Color
            if not row or len(row) < 5:
                continue  # skip malformed rows
            
            level_no = row[0].strip()
            theme_name = row[1].strip()
            complete_phrases = row[2].strip()
            puzzle = row[3].strip()
            color = row[4].strip()
            keyboard_color = row[5].strip() if len(row) > 5 else ""

            # Extract answer and lock positions using the original puzzle (with @ and #)
            answer, locks1, locks2, wordSpace = extract_missing_letters(complete_phrases, puzzle, level_no)
            # Replace '@' and '#' with '_' in the puzzle for final output.
            modified_puzzle = puzzle.replace('@', '_').replace('#', '_')

            entry = {
                "phrase": modified_puzzle,
                "answer": answer,
                "theme": theme_name,
                "color": color,
                "keyboard_color": keyboard_color
            }
            # Only add the lock keys if non-empty.
            if locks1:
                entry["locks1"] = locks1
            if locks2:
                entry["locks2"] = locks2
            

            levels[level_no] = entry
            phrases[level_no] = complete_phrases
    
    with open(json_filename, 'w', encoding='utf-8') as jsonfile:
        json.dump(levels, jsonfile, indent=4, ensure_ascii=False)
    print(f"JSON data successfully written to {json_filename}")
    
    phrases_filename = json_filename.replace('.json', '_phrases.json')
    with open(phrases_filename, 'w', encoding='utf-8') as phrasefile:
        json.dump(phrases, phrasefile, indent=4, ensure_ascii=False)
    print(f"Phrases JSON successfully written to {phrases_filename}")

if __name__ == "__main__":
    csv_filename = sys.argv[1] if len(sys.argv) > 1 else "csv/themed_puzzles.csv"
    json_filename = sys.argv[2] if len(sys.argv) > 2 else "generated/themed_puzzles.json"
    csv_to_json(csv_filename, json_filename)


# To do Add conversion of Unicode
# \u00e9 - é
# \u00f3 - ó
# \u2011 - -
# \u00ef - ï
# \u00fc - ü
# \u00f6 - ö
# \u00eb - ë
# \u0142 - ł
# \u00e7 - ç
# \u00f8 - ø
# \u2013 - -
