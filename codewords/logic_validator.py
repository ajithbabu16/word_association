import json
import argparse
import sys
import os
import random

# Fix for Windows Unicode errors
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')


class Tee:
    def __init__(self, *files):
        self.files = files
    
    def write(self, obj):
        for f in self.files:
            f.write(obj)
            f.flush()

    def flush(self):
        for f in self.files:
            f.flush()

# -----------------------------
# Core Data Structure
# -----------------------------

class Node:
    def __init__(self, char, index):
        self.char = char
        self.index = index

        self.is_punctuation = False
        self.is_blank = (char == '_')
        self.is_filled = not self.is_blank

        self.lock_type = 0      # 0 = none, 1 = single, 2 = double
        self.lock_strength = 0
        self.is_cloaked = False

        self.blank_index = -1
        self.word_id = -1


# -----------------------------
# Helpers & Punctuation
# -----------------------------

def is_punctuation(char):
    # Comprehensive list to ensure UI renders symbols correctly
    return char in [
        "%", "&", '“', '”', '‘', '’', '—', '–', '…'
    ]

def find_punctuation_misuse(phrase):
    """Checks for Error 8: Double quotes used as apostrophes within a word."""
    codes = []
    descriptions = []
    
    for i in range(1, len(phrase) - 1):
        char = phrase[i]
        # Detect standard or curly double quotes inside a word/slot sequence
        if char in ['"', '“', '”']:
            left = phrase[i-1]
            right = phrase[i+1]
            is_word_struct = (left.isalnum() or left == '_') and (right.isalnum() or right == '_')
            if is_word_struct:
                codes.append(8)
                descriptions.append(f"Stylized quote misuse at index {i}: '{char}' used as an apostrophe. Use a single quote (') or curly close apostrophe (’) instead.")
                break # Only need one to flag the level
                
    return codes, descriptions

def find_phrase_cleanliness_errors(phrase: str) -> (list, list):
    """Checks for Error 5: Forbidden special characters."""
    codes = []
    descriptions = []

    if not isinstance(phrase, str):
        phrase = ""

    # Detect misuse of double quotes as apostrophes
    m_codes, m_descs = find_punctuation_misuse(phrase)
    codes.extend(m_codes)
    descriptions.extend(m_descs)

    # --- Error 5: Forbidden Special Characters ---
    forbidden_chars = {
        '`', '~', '@', '#', '$', '^', '&', '*', '+', '=', '{', '[', '}', ']', '|', '\\', 
        '<', '>', '©', '®', '™', '€', '£', '¥', 'ö'
    }
    found_forbidden = [char for char in phrase if char in forbidden_chars]
    if found_forbidden:
        codes.append(5)
        chars_str = ", ".join(f"'{c}'" for c in sorted(set(found_forbidden)))
        descriptions.append(f"Forbidden characters found: {chars_str}.")

    return codes, descriptions

def find_lock_logic_errors(nodes):
    """Checks for Error 1: Lock logic placement rules (@ and #)."""
    errors = []
    for node in nodes:
        if node.lock_type == 0: continue
        
        # Rule: Locks must be on letters (represented as underscores in phrase)
        if node.char != '_':
            errors.append(f"Lock type {node.lock_type} at index {node.index} is incorrectly placed.")
            continue

        # Simple adjacency check (indices are consecutive)
        left_node = next((n for n in nodes if n.index == node.index - 1), None)
        right_node = next((n for n in nodes if n.index == node.index + 1), None)

        if node.lock_type == 1: # Single (@)
            l_is_blank = left_node and left_node.is_blank
            r_is_blank = right_node and right_node.is_blank
            if not (l_is_blank or r_is_blank):
                errors.append(f"Single lock @ at index {node.index} must be adjacent to another missing letter.")
        elif node.lock_type == 2: # Double (#)
            l_is_blank = left_node and left_node.is_blank
            r_is_blank = right_node and right_node.is_blank
            if not (l_is_blank and r_is_blank):
                errors.append(f"Double lock # at index {node.index} must be between two other missing letters.")
    return errors

class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    GRAY = "\033[90m"

def generate_cipher(answer):
    """
    Generate a random 1-26 mapping for the unique letters in the answer.
    """
    unique_chars = sorted(list(set(c for c in answer if c.isalpha())))
    numbers = list(range(1, 27))
    random.seed(42) # Consistent seed for reproducibility during debugging
    random.shuffle(numbers)
    
    cipher = {}
    for i, char in enumerate(unique_chars):
        if i < len(numbers):
            cipher[char] = numbers[i]
        else:
             # Fallback if somehow more than 26 unique chars (unlikely in codewords)
             cipher[char] = 99
             
    return cipher

def render_with_phrase(nodes, phrase, answer, cipher, known_chars=None):
    """
    Render puzzle with word wrapping, dual rows (Text + Mapping), and ANSI colors.
    """
    if known_chars is None:
        known_chars = set()

    MAX_WIDTH = 80
    
    # Pre-process nodes into tokens (Word + Space)
    lines = []
    current_line_nodes = []
    current_line_width = 0
    
    # We iterate words in phrase
    phrase_words = phrase.split(' ')
    node_cursor = 0
    
    for word_idx, word in enumerate(phrase_words):
        word_nodes = []
        clean_word = word
        if word.startswith("|") and word.endswith("|"):
            clean_word = word[1:-1]
            
        word_len = len(clean_word)
        
        # Collect nodes for this word
        for _ in range(word_len):
            if node_cursor < len(nodes):
                word_nodes.append(nodes[node_cursor])
                node_cursor += 1
        
        # Determine width of this word (plus trailing space if not last)
        # We use 3 chars per letter (Content=2 + Gap=1)
        # Word gap is 4 spaces
        width_needed = (word_len * 3) + (4 if word_idx < len(phrase_words) - 1 else 0)
        
        # Wrap if needed
        if current_line_width + width_needed > MAX_WIDTH:
            lines.append(current_line_nodes)
            current_line_nodes = []
            current_line_width = 0
            
        current_line_nodes.extend(word_nodes)
        
        # Add space node (virtual) if not last word
        if word_idx < len(phrase_words) - 1:
            current_line_nodes.append(None) # None = Space
            
        current_line_width += width_needed
        
    if current_line_nodes:
        lines.append(current_line_nodes)
        
    # Render Logic
    final_output = ""
    
    for line in lines:
        line_top = ""
        line_bot = ""
        
        for node in line:
            if node is None:
                # Word Break - Large Space (4)
                line_top += "    " 
                line_bot += "    "
                continue
            
            # Content Cell (Width 2)
            val_top = "  "
            val_bot = "  "
            
            if node.is_punctuation:
                 val_top = f"{Colors.GRAY}{node.char}{Colors.RESET} "
                 val_bot = "  "
            elif node.is_blank:
                # Top
                if node.is_filled:
                     letter = '?'
                     if 0 <= node.blank_index < len(answer):
                         letter = answer[node.blank_index]
                     val_top = f"{Colors.GREEN}{Colors.BOLD}{letter}{Colors.RESET} "
                else:
                    val_top = "_ "
                
                # Bot
                target_char = '?'
                if 0 <= node.blank_index < len(answer):
                    target_char = answer[node.blank_index]
                
                map_val = f"{cipher.get(target_char, 0):02d}"
                
                if node.is_cloaked and target_char not in known_chars:
                    val_bot = f"{Colors.BLUE}??{Colors.RESET}"
                else:
                    color = Colors.GRAY
                    if node.lock_type == 1 and not node.is_filled:
                        color = Colors.RED
                    elif node.lock_type == 2 and not node.is_filled:
                        color = Colors.MAGENTA
                    elif node.is_filled:
                        color = Colors.GRAY 
                    
                    val_bot = f"{color}{map_val}{Colors.RESET}"
            else:
                # Pre-filled
                val_top = f"{Colors.BOLD}{node.char}{Colors.RESET} "
                val_bot = "  "
            
            # Append cell + 1 space separator
            line_top += f"{val_top} "
            line_bot += f"{val_bot} "
            
        final_output += line_top + "\n" + line_bot + "\n\n"
        
    return final_output


# -----------------------------
# Phrase Parsing (matches game)
# -----------------------------

def parse_level_nodes(phrase, answer, locks1, locks2, cloaks):
    nodes = []
    blank_counter = 0
    node_index = 0
    word_id_counter = 0

    words = phrase.split(' ')

    for word in words:
        is_special = False
        if word.startswith("|") and word.endswith("|"):
            is_special = True
            word = word[1:-1]

        for ch in word:
            node = Node(ch, node_index)

            if is_punctuation(ch):
                node.is_punctuation = True
                node.is_blank = False
                node.is_filled = True

            elif is_special:
                node.is_blank = False
                node.is_filled = True

            elif ch == '_':
                node.is_blank = True
                node.is_filled = False
                node.blank_index = blank_counter

                if blank_counter in locks1:
                    node.lock_type = 1
                    node.lock_strength = 1
                elif blank_counter in locks2:
                    node.lock_type = 2
                    node.lock_strength = 2

                if blank_counter in cloaks:
                    node.is_cloaked = True

                blank_counter += 1

            else:
                node.is_blank = False
                node.is_filled = True

            node.word_id = word_id_counter
            nodes.append(node)
            node_index += 1
            
        word_id_counter += 1

    return nodes, blank_counter


# -----------------------------
# Solvability Simulation
# -----------------------------

def simulate_solvability(nodes, phrase, answer, visual=False, trace_enabled=False):
    blanks = [n for n in nodes if n.is_blank]
    trace = []
    step = 0
    
    # Track known characters (mappings revealed)
    known_chars = set()
    cipher = generate_cipher(answer)
    
    # Validation Metrics Data
    metrics = {
        "l1_count": len([n for n in nodes if n.lock_type == 1]),
        "l2_count": len([n for n in nodes if n.lock_type == 2]),
        "cloak_count": len([n for n in nodes if n.is_cloaked]),
        "total_blanks": len(blanks),
        "unique_chars": len(set(answer)),
        "unlocked_history": [],
        "exposure_history": [],
        "blocked_history": []
    }

    if visual:
        print("\nInitial State:")
        print(render_with_phrase(nodes, phrase, answer, cipher, known_chars))
        print(f"Legend: {Colors.GREEN}A{Colors.RESET}=Filled  {Colors.GRAY}_{Colors.RESET}=Blank  {Colors.RED}05{Colors.RESET}=Lock1  {Colors.MAGENTA}05{Colors.RESET}=Lock2  {Colors.BLUE}??{Colors.RESET}=Cloak")

    while True:
        # Exposure Metric: Count visible (unfilled) nodes.
        metrics["exposure_history"].append(len([n for n in blanks if not n.is_filled]))
        # Find all fillable blanks
        # Rule: Blank is fillable if:
        # 1. Not already filled
        # 2. Not Locked (L1/L2)
        # 3. Not Cloaked OR (Cloaked but mapping is known)
        unlocked = []
        for n in blanks:
            if n.is_filled:
                continue
            
            if n.lock_type > 0:
                continue
            
            target_char = answer[n.blank_index]
            if n.is_cloaked and target_char not in known_chars:
                continue
                
            unlocked.append(n)
        
        # Priority Sort: User requested optimal play.
        # "He should be filling first the letters which are revealed"
        # Sort unlocked: Known chars FIRST, then Unknown (New Discoveries).
        unlocked.sort(key=lambda n: (answer[n.blank_index] not in known_chars, n.blank_index))
        
        # Scarcity Metric: How many moves were available?
        metrics["unlocked_history"].append(len(unlocked))
        
        if not unlocked:
            # Fallback: Try to Guess a Cloaked Node
            # User Feedback: "A cloak is not typically blocked a user can make guess..."
            # If we are stuck on logic, we simulated a guess.
            guessable = [
                n for n in blanks
                if not n.is_filled
                and n.lock_type == 0
                and n.is_cloaked
                and answer[n.blank_index] not in known_chars
            ]
            
            if guessable:
                # Make a guess
                node = guessable[0]
                guessed_char = answer[node.blank_index]
                step += 1
                node.is_filled = True
                known_chars.add(guessed_char)
                
                metrics["forced_guesses"] = metrics.get("forced_guesses", 0) + 1
                
                entry = {
                    "step": step,
                    "filled_blank": node.blank_index,
                    "action": "guessed",
                    "unlocked": []
                }
                
                # Update beams (Copy paste beam logic or refactor? Let's keep inline for now)
                # Left
                for i in range(node.index - 1, -1, -1):
                    neighbor = nodes[i]
                    if neighbor.is_punctuation: continue
                    if neighbor.is_blank and neighbor.lock_type > 0:
                        neighbor.lock_strength -= 1
                        entry["unlocked"].append({
                            "blank": neighbor.blank_index, "new_strength": neighbor.lock_strength
                        })
                        if neighbor.lock_strength <= 0:
                            neighbor.lock_type = 0; neighbor.lock_strength = 0
                    break
                    
                # Right
                for i in range(node.index + 1, len(nodes)):
                    neighbor = nodes[i]
                    if neighbor.is_punctuation: continue
                    if neighbor.is_blank and neighbor.lock_type > 0:
                        neighbor.lock_strength -= 1
                        entry["unlocked"].append({
                            "blank": neighbor.blank_index, "new_strength": neighbor.lock_strength
                        })
                        if neighbor.lock_strength <= 0:
                            neighbor.lock_type = 0; neighbor.lock_strength = 0
                    break
                
                trace.append(entry)
                metrics.setdefault("unlock_events", []).append(len(entry["unlocked"]))
                
                if visual:
                    print(f"\nStep {step}: {Colors.YELLOW}Guessed{Colors.RESET} blank #{node.blank_index} (Char: {guessed_char})")
                    print(render_with_phrase(nodes, phrase, answer, cipher, known_chars))
                
                continue
            else:
                # Truly stuck
                break

        # In a real game, the user picks ONE. 
        # But validation assumes optimal play: if any is available, we take it.
        
        progress_made_in_inner_loop = False
        
        for node in unlocked:
            if node.is_filled: continue # Already filled by previous iter in this loop?
            
            target_char = answer[node.blank_index]
            is_new_mapping = target_char not in known_chars
            
            # User Request: If mapping is unknown, it counts as a GUESS.
            # Regardless of word context ("Contextual Solves" are still guesses).
            
            action_type = "filled"
            if is_new_mapping:
                metrics["forced_guesses"] = metrics.get("forced_guesses", 0) + 1
                action_type = "guessed (new char)"
                if visual:
                    print(f"\n{Colors.RED}Forced Guess!{Colors.RESET} Unknown mapping for blank #{node.blank_index} ('{target_char}')")

            step += 1
            node.is_filled = True
            known_chars.add(target_char) # Reveal the mapping
            progress_made_in_inner_loop = True
            
            entry = {
                "step": step,
                "filled_blank": node.blank_index,
                "action": action_type,
                "unlocked": []
            }

            # Left unlock beam
            for i in range(node.index - 1, -1, -1):
                neighbor = nodes[i]
                if neighbor.is_punctuation:
                    continue

                if neighbor.is_blank and neighbor.lock_type > 0:
                    neighbor.lock_strength -= 1
                    entry["unlocked"].append({
                        "blank": neighbor.blank_index,
                        "new_strength": neighbor.lock_strength
                    })
                    if neighbor.lock_strength <= 0:
                        neighbor.lock_type = 0
                        neighbor.lock_strength = 0
                break

            # Right unlock beam
            for i in range(node.index + 1, len(nodes)):
                neighbor = nodes[i]
                if neighbor.is_punctuation:
                    continue

                if neighbor.is_blank and neighbor.lock_type > 0:
                    neighbor.lock_strength -= 1
                    entry["unlocked"].append({
                        "blank": neighbor.blank_index,
                        "new_strength": neighbor.lock_strength
                    })
                    if neighbor.lock_strength <= 0:
                        neighbor.lock_type = 0
                        neighbor.lock_strength = 0
                break

            trace.append(entry)
            metrics.setdefault("unlock_events", []).append(len(entry["unlocked"]))

            if visual:
                print(f"\nStep {step}: Fill blank #{node.blank_index}")
                print(render_with_phrase(nodes, phrase, answer, cipher, known_chars))
            
            # Optimal Play: Execute ONE best move, then re-evaluate board.
            # This allows new info (Known Chars) to immediately influence priority of next move.
            break
        
        # If we finished the loop, check if we made progress.
        # If not (e.g. unlocked was empty - handled by break above), we stop.
        # But since we iterate `unlocked`, we made progress.
        # We should iterate again to pick up newly un-cloaked nodes.
        pass

    remaining = [n for n in blanks if not n.is_filled]
    metrics["steps"] = step
    return len(remaining) == 0, remaining, trace, metrics

def calculate_difficulty(metrics):
    """
    Expert-level difficulty model.
    Measures pain points, not averages.
    """

    total = max(metrics.get("total_blanks", 1), 1)

    # -----------------------------
    # 1. Structural Pressure
    # -----------------------------
    l1 = metrics.get("l1_count", 0)
    l2 = metrics.get("l2_count", 0)
    cloaks = metrics.get("cloak_count", 0)

    structural = (
        (l1 * 1.2) +
        (l2 * 2.8) +
        (cloaks * 2.0)
    ) / total * 10


    # -----------------------------
    # 2. Forced Guess Penalty (HUGE)
    # -----------------------------
    forced_guesses = metrics.get("forced_guesses", 0)
    guess_score = min(10, forced_guesses * 4.5)


    # -----------------------------
    # 3. Early-Game Starvation
    # -----------------------------
    unlocked_hist = metrics.get("unlocked_history", [])
    early_window = max(1, int(len(unlocked_hist) * 0.25))
    early_moves = unlocked_hist[:early_window]

    if early_moves:
        early_pressure = sum(
            1.0 / max(1, m) for m in early_moves
        ) / len(early_moves) * 10
    else:
        early_pressure = 0


    # -----------------------------
    # 4. Stall Length (Frustration)
    # -----------------------------
    longest_stall = 0
    current = 0
    for m in unlocked_hist:
        if m <= 1:
            current += 1
            longest_stall = max(longest_stall, current)
        else:
            current = 0

    stall_score = min(10, longest_stall * 1.5)


    # -----------------------------
    # 5. Unlock Cascades (Cognitive Load)
    # -----------------------------
    unlock_events = metrics.get("unlock_events", [])
    if unlock_events:
        avg_chain = sum(unlock_events) / len(unlock_events)
        # Avg 1.0 (Sustained Chain) -> Score 10.0.
        cascade_score = min(10, avg_chain * 10.0)
    else:
        cascade_score = 0


    # -----------------------------
    # Final Weighted Score
    # -----------------------------
    raw = (
        structural * 0.20 +
        guess_score * 0.30 +
        early_pressure * 0.20 +
        stall_score * 0.20 +
        cascade_score * 0.10
    )

    final = round(max(1.0, min(10.0, raw)), 1)

    details = {
        "Struct": round(structural, 2),
        "Guesses": forced_guesses,
        "Early": round(early_pressure, 2),
        "Stall": round(stall_score, 2),
        "Cascade": round(cascade_score, 2)
    }

    return final, details


# -----------------------------
# Validation
# -----------------------------

def validate_file(file_path, visual=False, trace_enabled=False, puzzles_to_check=None):
    print(f"Validating {file_path}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Schema Detection
    # Case A: {"puzzles": {"KEY": {...}, ...}} (Daily Puzzles)
    # Case B: {"KEY": {...}, ...} (Main Levels / level_v3.json)
    if "puzzles" in data:
        puzzles_dict = data["puzzles"]
    else:
        puzzles_dict = data

    all_passed = True

    puzzle_items = puzzles_dict.items()
    if puzzles_to_check:
        puzzle_items = [(k, v) for k, v in puzzle_items if k in puzzles_to_check]
        if not puzzle_items:
            print(f"Warning: No puzzles found matching keys: {puzzles_to_check}")

    for level_id, level_data in puzzle_items:
        phrase = level_data.get("phrase", "")
        answer = level_data.get("answer", "")
        locks1 = level_data.get("locks1", [])
        locks2 = level_data.get("locks2", [])
        cloaks = level_data.get("cloak", [])

        # 1. Structural Initialization
        nodes, total_blanks = parse_level_nodes(phrase, answer, locks1, locks2, cloaks)
        level_errors = []

        # Error 4: Length Mismatch
        if len(answer) != total_blanks:
            level_errors.append((4, f"Answer length mismatch ({len(answer)} vs {total_blanks})"))

        # Error 10: Cloak Rule ($ cannot coexist with @ or #)
        if cloaks and (locks1 or locks2):
            level_errors.append((10, "Cloak rule violation: cloaks cannot coexist with locks (@ or #) in same level."))

        # New V1 Cloak Rules (Min 4 total, Max 2 unique)
        if cloaks:
            if len(cloaks) < 4:
                level_errors.append((11, f"Cloak count violation: Level has only {len(cloaks)} cloaks. V1 requires at least 4 total."))
            
            unique_cloaked_chars = set()
            for idx in cloaks:
                if idx < len(answer):
                    unique_cloaked_chars.add(answer[idx].upper())
            
            if len(unique_cloaked_chars) > 2:
                level_errors.append((12, f"Cloak variety violation: Level has cloaks on {len(unique_cloaked_chars)} unique letters ({', '.join(sorted(unique_cloaked_chars))}). V1 allows max 2."))

        # Error 7, 6, 5: Cleanliness
        c_codes, c_descs = find_phrase_cleanliness_errors(phrase)
        for code, desc in zip(c_codes, c_descs):
            level_errors.append((code, desc))

        # Error 1: Lock Logic Placement
        lock_errors = find_lock_logic_errors(nodes)
        if lock_errors:
            level_errors.append((1, "; ".join(lock_errors)))

        if level_errors:
            print(f"❌ Level {level_id} FAILED Data Validation!")
            for code, desc in sorted(level_errors, reverse=True):
                print(f"   [Error {code}] {desc}")
            all_passed = False
            continue

        # 2. Solvability Simulation
        success, remaining, trace, metrics = simulate_solvability(
            nodes, phrase, answer, visual=visual, trace_enabled=trace_enabled
        )
        
        score, details = calculate_difficulty(metrics)
        print(f"   Difficulty: {score}/10  {Colors.GRAY}{details}{Colors.RESET}")

        if not success:
            all_passed = False
            print(f"❌ Level {level_id} FAILED Solvability!")
            print(f"   Reason: Deadlock. {len(remaining)} blanks remaining.")
            if not visual:
                temp_cipher = generate_cipher(answer)
                print("\n   Final State:")
                print(render_with_phrase(nodes, phrase, answer, temp_cipher, set()))
        else:
            if not visual and not trace_enabled:
                 print(f"✅ Level {level_id} OK")

        if trace_enabled:
            print("\n--- TRACE ---")
            for t in trace:
                print(
                    f"Step {t['step']}: Filled blank #{t['filled_blank']} "
                    f"→ unlocked {t['unlocked']}"
                )

    if all_passed:
        print("\n✅ All puzzles are solvable.")

    return all_passed


# -----------------------------
# CLI
# -----------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Validate level.json files for puzzle solvability"
    )

    parser.add_argument('--file', required=True, help='Path to level.json')
    parser.add_argument('--visual', action='store_true', help='Show visual simulation')
    parser.add_argument('--trace', action='store_true', help='Show step-by-step trace')
    parser.add_argument('--puzzles', nargs='+', help='List of specific puzzle keys to validate')
    parser.add_argument('--out', help='Output file to save report')

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"File not found: {args.file}")
        sys.exit(1)

    out_file = None
    if args.out:
        try:
            out_file = open(args.out, 'w', encoding='utf-8')
            sys.stdout = Tee(sys.stdout, out_file)
        except Exception as e:
            print(f"Error opening output file: {e}")
            sys.exit(1)

    success = validate_file(
        args.file,
        visual=args.visual,
        trace_enabled=args.trace,
        puzzles_to_check=args.puzzles
    )

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
