import pandas as pd
import os
import datetime

from typing import Tuple

def find_phrase_cleanliness_errors(phrase: str, is_complete_phrase: bool = True) -> Tuple[list, list]:
    codes = []
    descriptions = []
    if pd.isna(phrase) or not isinstance(phrase, str):
        phrase = ""

    forbidden_chars = {'`', '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '=', '{', '[', '}', ']',
                       '|', '\\', ':', ';', '<', '>', '?', '/', '“', '”', '‘', '’', '—', '–', '…', '©', '®', '™', '€',
                       '£', '¥', '——','--', 'ö'}
    found_forbidden = []
    for char in phrase:
        if char in forbidden_chars:
            if char not in found_forbidden:
                found_forbidden.append(char)

    if found_forbidden:
        codes.append(5)
        chars_str = ", ".join(f"'{c}'" for c in found_forbidden)
        descriptions.append(
            f"Forbidden characters found: {chars_str}. Use standard quotes, hyphens, and ellipses (...)."
        )

    stripped_phrase = phrase.strip()
    if not stripped_phrase:
        return codes, descriptions

    if is_complete_phrase:
        valid_ending = '.'
        if stripped_phrase[-1] != valid_ending:
            codes.append(6)
            descriptions.append("Phrase must end with a period ('.').")

    return codes, descriptions

def find_structural_mismatches(phrase, puzzle):
    errors = []
    if len(phrase) != len(puzzle):
        errors.append(f"Length mismatch: Answer has {len(phrase)} chars, Puzzle has {len(puzzle)}.")
        return errors

    for i, (p_char, s_char) in enumerate(zip(puzzle, phrase)):
        is_phrase_char_alpha = s_char.isalpha()
        is_puzzle_char_a_slot = p_char.isalpha() or p_char in ['_', '@', '#', '$']
        if is_phrase_char_alpha != is_puzzle_char_a_slot:
            errors.append(
                f"Structural mismatch at position {i}: Mismatch between letter-slot and non-letter character.")
            break
    return errors

def find_capitalization_errors(phrase):
    errors = []
    if not phrase:
        return errors
        
    first_alpha_idx = -1
    first_underscore_idx = -1
    
    for i, char in enumerate(phrase):
        if char.isalpha() and first_alpha_idx == -1:
            first_alpha_idx = i
        if char == '_' and first_underscore_idx == -1:
            first_underscore_idx = i
            
    require_first_cap = True
    if first_alpha_idx != -1 and first_underscore_idx != -1:
        if first_underscore_idx < first_alpha_idx:
            require_first_cap = False
            
    stripped = phrase.lstrip(' "\'“‘[({')
    if stripped.startswith('.'):
        require_first_cap = False
        
    first_letter_found = False
    for char in phrase:
        if char.isalpha():
            if require_first_cap and not char.isupper():
                errors.append("First letter is not capitalized.")
            first_letter_found = True
            break
            
    if not first_letter_found:
        return errors
        
    expect_uppercase = False
    for char in phrase:
        if char == '.':
            expect_uppercase = True
        elif expect_uppercase and char.isalpha():
            if not char.isupper():
                if "Capitalization missing after a period." not in errors:
                    errors.append("Capitalization missing after a period.")
            expect_uppercase = False
        elif expect_uppercase and not char.isspace() and char not in ['"', "'", '“', '”', '‘', '’', '_']:
            expect_uppercase = False
            
    return errors

def find_character_mismatches(phrase, puzzle):
    errors = []
    for i, (s_char, p_char) in enumerate(zip(phrase, puzzle)):
        if s_char.isalpha():
            if p_char != s_char and p_char not in ['_', '@', '#', '$']:
                errors.append(
                    f"Invalid character '{p_char}' in Puzzle at position {i}; expected '{s_char}' or a placeholder.")
        else:
            if s_char != p_char:
                errors.append(f"Mismatch at position {i}: Puzzle has '{p_char}' where Answer has '{s_char}'.")
    return errors

def find_word_boundaries(phrase_text, index):
    if index >= len(phrase_text) or not phrase_text[index].isalpha():
        return -1, -1
    start = index
    while start > 0 and phrase_text[start - 1].isalpha():
        start -= 1
    end = index
    while end < len(phrase_text) - 1 and phrase_text[end + 1].isalpha():
        end += 1
    return start, end

def find_lock_logic_errors(phrase, puzzle):
    errors = []
    for i, p_char in enumerate(puzzle):
        if p_char not in ['@', '#']:
            continue
        start, end = find_word_boundaries(phrase, i)
        if start == -1:
            errors.append(
                f"Lock character '{p_char}' at position {i} is incorrectly placed on a non-alphabetic character.")
            continue
        word_len = (end - start + 1)
        if p_char == '@':
            if word_len == 1:
                errors.append(f"Single lock '@' at position {i} cannot be on a single-letter word.")
            prev_is_missing = (i > start and puzzle[i - 1] in ['_', '@', '#', '$'])
            next_is_missing = (i < end and puzzle[i + 1] in ['_', '@', '#', '$'])
            if not (prev_is_missing or next_is_missing):
                errors.append(f"Single lock '@' at position {i} must be adjacent to another missing letter.")
        elif p_char == '#':
            if word_len <= 2:
                errors.append(f"Double lock '#' at position {i} cannot be on a word of length 1 or 2.")
            if i == start or i == end:
                errors.append(f"Double lock '#' at position {i} cannot be at the start or end of a word.")
            if i > start and i < end:
                prev_is_missing = (puzzle[i - 1] in ['_', '@', '#', '$'])
                next_is_missing = (puzzle[i + 1] in ['_', '@', '#', '$'])
                if not (prev_is_missing and next_is_missing):
                    errors.append(f"Double lock '#' at position {i} must be between two other missing letters.")
    return errors

def validate_pair(phrase, puzzle, is_complete_phrase=False):
    found_codes = []
    found_descriptions = []
    
    phrase_str = str(phrase) if pd.notna(phrase) else ""
    puzzle_str = str(puzzle) if pd.notna(puzzle) else ""
    
    if not phrase_str and not puzzle_str:
        return ""
    
    structural_ok = len(phrase_str) == len(puzzle_str)

    cleanliness_codes, cleanliness_desc = find_phrase_cleanliness_errors(phrase_str, is_complete_phrase)
    if cleanliness_codes:
        found_codes.extend(cleanliness_codes)
        found_descriptions.extend(cleanliness_desc)

    errors_3 = find_structural_mismatches(phrase_str, puzzle_str)
    if errors_3:
        found_codes.append(3)
        found_descriptions.extend(errors_3)

    if is_complete_phrase:
        errors_2 = find_capitalization_errors(phrase_str)
        if errors_2:
            found_codes.append(2)
            found_descriptions.extend(errors_2)

    if structural_ok:
        errors_4 = find_character_mismatches(phrase_str, puzzle_str)
        if errors_4:
            found_codes.append(4)
            found_descriptions.extend(errors_4)

        errors_1 = find_lock_logic_errors(phrase_str, puzzle_str)
        if errors_1:
            found_codes.append(1)
            found_descriptions.extend(errors_1)

    if not found_codes:
        return "Pass"
    else:
        return "; ".join(found_descriptions)

import sys

def main():
    base_dir = r"c:\word_association\zen_crostic"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        if not os.path.isabs(input_file):
            input_file = os.path.join(base_dir, input_file)
    else:
        # Default fallback
        if os.path.exists(os.path.join(base_dir, "ZenCrost.xlsx")):
            input_file = os.path.join(base_dir, "ZenCrost.xlsx")
        elif os.path.exists(os.path.join(base_dir, "ZenCrost.csv")):
            input_file = os.path.join(base_dir, "ZenCrost.csv")
        else:
            print("Error: No input file provided and default ZenCrost.xlsx or ZenCrost.csv not found.")
            return
            
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return
        
    file_ext = os.path.splitext(input_file)[1].lower()
    if file_ext == '.csv':
        try:
            df = pd.read_csv(input_file, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(input_file, encoding='cp1252')
    elif file_ext in ['.xlsx', '.xls']:
        df = pd.read_excel(input_file)
    else:
        print(f"Error: Unsupported file format {file_ext}. Please use .csv or .xlsx")
        return
    
    # Define constants for length rules
    MAX_PHRASE_LEN = 35
    MAX_WORD_LEN = 13
    MAX_Q_LEN = 50
    MAX_A_LEN = 13

    # Process "Complete Phrase" and "Puzzle" (which in this excel is Phrase and Puzzle)
    def validate_phrase_row(row):
        phrase = str(row.get('Phrase', '')) if pd.notna(row.get('Phrase')) else ""
        res = validate_pair(phrase, row.get('Puzzle'), is_complete_phrase=True)
        
        errors = []
        if phrase:
            # Phrase letter count without spaces
            phrase_no_space = phrase.replace(" ", "")
            if len(phrase_no_space) > MAX_PHRASE_LEN:
                errors.append(f"Phrase length ({len(phrase_no_space)}) exceeds max {MAX_PHRASE_LEN}.")
                
            # Phrase max word length
            words = phrase.split()
            max_word = max((len(w) for w in words), default=0)
            if max_word > MAX_WORD_LEN:
                errors.append(f"Max word length ({max_word}) exceeds max {MAX_WORD_LEN}.")
                
        if errors:
            if res == "Pass" or not res:
                return "; ".join(errors)
            else:
                return res + "; " + "; ".join(errors)
        return res

    df['Phrase Validation'] = df.apply(validate_phrase_row, axis=1)
    
    # Process A1-A10 and Puzzle 1-10 (and Q1-Q10 for capitalization and length)
    for i in range(1, 11):
        ans_col = f'A{i}'
        puz_col = f'Puzzle {i}'
        q_col = f'Q{i}'
        
        if ans_col in df.columns and puz_col in df.columns:
            out_col = f'A{i} Validation'
            
            def validate_row_item(row, a_c=ans_col, p_c=puz_col, q_c=q_col):
                a_val = row.get(a_c)
                p_val = row.get(p_c)
                q_val = row.get(q_c)
                
                # Get the existing validation for A and Puzzle
                res = validate_pair(a_val, p_val, is_complete_phrase=False)
                
                # Check Q capitalization, dash length, and general lengths
                q_errors = []
                q_str = str(q_val).strip() if pd.notna(q_val) else ""
                a_str = str(a_val).strip() if pd.notna(a_val) else ""
                
                if q_str:
                    q_no_space = q_str.replace(" ", "")
                    if len(q_no_space) > MAX_Q_LEN:
                        q_errors.append(f"{q_c}: Length ({len(q_no_space)}) exceeds max {MAX_Q_LEN}.")
                        
                if a_str:
                    a_no_space = a_str.replace(" ", "")
                    if len(a_no_space) > MAX_A_LEN:
                        q_errors.append(f"{a_c}: Length ({len(a_no_space)}) exceeds max {MAX_A_LEN}.")
                
                # Check for 5 or more consecutive underscores or dashes
                if '_____' in q_str or '-----' in q_str:
                    q_errors.append(f"{q_c}: Contains 5 or more consecutive dashes/underscores (should be exactly 4).")
                
                # Find the first letter to check if it's capitalized
                first_letter_found = False
                for char in q_str:
                    if char.isalpha():
                        if not char.isupper():
                            q_errors.append(f"{q_c}: First letter is not capitalized.")
                        first_letter_found = True
                        break
                        
                if q_errors:
                    if res == "Pass" or not res:
                        return "; ".join(q_errors)
                    else:
                        return res + "; " + "; ".join(q_errors)
                return res if res else ""
                
            df[out_col] = df.apply(validate_row_item, axis=1)

    # Compute Stats Columns
    def compute_stats(row, with_spaces=True):
        stats = []
        phrase = str(row.get('Phrase', '')) if pd.notna(row.get('Phrase')) else ""
        if phrase:
            p_len = len(phrase) if with_spaces else len(phrase.replace(" ", ""))
            words = phrase.split()
            max_w = max((len(w) if with_spaces else len(w.replace(" ", ""))) for w in words) if words else 0
            stats.append(f"Phrase={p_len}, Word={max_w}")
            
        for i in range(1, 11):
            q_val = str(row.get(f'Q{i}', '')) if pd.notna(row.get(f'Q{i}')) else ""
            a_val = str(row.get(f'A{i}', '')) if pd.notna(row.get(f'A{i}')) else ""
            if q_val or a_val:
                q_len = len(q_val) if with_spaces else len(q_val.replace(" ", ""))
                a_len = len(a_val) if with_spaces else len(a_val.replace(" ", ""))
                stats.append(f"Q{i}<>A{i}={q_len}<>{a_len}")
                
        return ", ".join(stats)
        
    df['Lengths (With Spaces)'] = df.apply(lambda r: compute_stats(r, True), axis=1)
    df['Lengths (Without Spaces)'] = df.apply(lambda r: compute_stats(r, False), axis=1)

    def compute_length_status(row):
        phrase = str(row.get('Phrase', '')) if pd.notna(row.get('Phrase')) else ""
        if phrase:
            phrase_no_space = phrase.replace(" ", "")
            if len(phrase_no_space) > MAX_PHRASE_LEN:
                return "Fail"
            words = phrase.split()
            max_w = max((len(w) for w in words), default=0)
            if max_w > MAX_WORD_LEN:
                return "Fail"
                
        for i in range(1, 11):
            q_val = str(row.get(f'Q{i}', '')) if pd.notna(row.get(f'Q{i}')) else ""
            a_val = str(row.get(f'A{i}', '')) if pd.notna(row.get(f'A{i}')) else ""
            if q_val:
                if len(q_val.replace(" ", "")) > MAX_Q_LEN:
                    return "Fail"
            if a_val:
                if len(a_val.replace(" ", "")) > MAX_A_LEN:
                    return "Fail"
        return "Pass"
        
    df['Length Status'] = df.apply(compute_length_status, axis=1)

    # --- Duplicate Analysis Across All Columns ---
    print("Checking for exact duplicates across columns...")
    df['Duplication Check'] = ""
    
    # Define columns to check for duplicates
    cols_to_check = ['Phrase']
    for i in range(1, 11):
        cols_to_check.extend([f'Q{i}', f'A{i}'])
        
    # Check each column
    for col in cols_to_check:
        if col in df.columns:
            # Find all non-empty values that appear more than once
            # Convert to string and strip whitespace for accurate comparison
            valid_mask = df[col].notna() & (df[col].astype(str).str.strip() != "")
            
            # Get values that are duplicated
            val_counts = df.loc[valid_mask, col].astype(str).str.strip().value_counts()
            duplicate_vals = val_counts[val_counts > 1].index.tolist()
            
            if duplicate_vals:
                # Find all rows that have these duplicate values
                for val in duplicate_vals:
                    # Find indices where the value matches the duplicate value
                    dup_indices = df[df[col].astype(str).str.strip() == val].index
                    
                    # Append the column name to the 'Duplication Check' for these rows
                    for idx in dup_indices:
                        other_indices = [i for i in dup_indices if i != idx]
                        if not other_indices: 
                            continue
                            
                        if 'Level_Number' in df.columns:
                            other_levels = df.loc[other_indices, 'Level_Number'].tolist()
                            msg = f"{col} (dup of Lvl {', '.join(map(str, other_levels))})"
                        else:
                            # Fallback to row number (1-indexed + header)
                            other_rows = [i + 2 for i in other_indices]
                            msg = f"{col} (dup of Row {', '.join(map(str, other_rows))})"
                            
                        current_val = df.at[idx, 'Duplication Check']
                        if current_val:
                            df.at[idx, 'Duplication Check'] = current_val + f"; {msg}"
                        else:
                            df.at[idx, 'Duplication Check'] = msg
                            
    # Clean up empty strings to say "Pass" or "No Duplicates" for clarity (optional, but requested format usually leaves blank or pass)
    df['Duplication Check'] = df['Duplication Check'].apply(lambda x: x if x else "Pass")
    print("Duplication check complete.")
    
    def calculate_missing_letters(row):
        phrase = str(row.get('Phrase', '')) if pd.notna(row.get('Phrase')) else ""
        phrase_letters = set(char.upper() for char in phrase if char.isalpha())
        
        answer_letters = set()
        for i in range(1, 11):
            ans_col = f'A{i}'
            if ans_col in row and pd.notna(row[ans_col]):
                ans = str(row[ans_col])
                answer_letters.update(char.upper() for char in ans if char.isalpha())
                
        missing_letters = sorted(list(phrase_letters - answer_letters))
        unique_str = ", ".join(sorted(list(phrase_letters)))
        missing_str = ", ".join(missing_letters) if missing_letters else "Pass"
        
        return pd.Series([unique_str, missing_str])

    df[['Unique Letters', 'Missing Letters']] = df.apply(calculate_missing_letters, axis=1)
            
    # Save output with timestamp
    output_dir = os.path.join(base_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    
    if file_ext == '.csv':
        output_filename = f"{base_name}_validated_{timestamp}.csv"
        output_path = os.path.join(output_dir, output_filename)
        df.to_csv(output_path, index=False)
    else:
        output_filename = f"{base_name}_validated_{timestamp}.xlsx"
        output_path = os.path.join(output_dir, output_filename)
        df.to_excel(output_path, index=False)
        
    print(f"Validation complete. Saved to: {output_path}")

if __name__ == '__main__':
    main()
