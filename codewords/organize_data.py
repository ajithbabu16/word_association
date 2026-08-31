import os
import shutil
import glob

# Source Directory
SOURCE_DIR = "/Users/Shared/Code/codewords/assets/resources/daily_puzzles"
# Destination
DEST_DIR = "data"

def organize():
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)
        print(f"Created {DEST_DIR}/")

    # Walk or simple iter? The structure seems to be {SOURCE}/{YYYY_MM}/data/level.json
    # Let's iterate the subfolders in SOURCE_DIR
    
    count = 0
    
    # Walk daily puzzles
    if os.path.exists(SOURCE_DIR):
        for folder_name in os.listdir(SOURCE_DIR):
            folder_path = os.path.join(SOURCE_DIR, folder_name)
            if not os.path.isdir(folder_path):
                continue
                
            # Target file
            level_file = os.path.join(folder_path, "data", "level.json")
            if os.path.exists(level_file):
                # Destination Name: YYYY_MM.json
                dest_name = f"{folder_name}.json"
                dest_path = os.path.join(DEST_DIR, dest_name)
                
                shutil.copy2(level_file, dest_path)
                print(f"Copied {folder_name} -> {dest_path}")
                count += 1
    
    # 2. Main Levels
    MAIN_LEVELS_DIR = "/Users/Shared/Code/codewords/assets/resources/datas/level"
    if os.path.exists(MAIN_LEVELS_DIR):
        for filename in os.listdir(MAIN_LEVELS_DIR):
            if filename.endswith(".json") and "level" in filename:
                 src_path = os.path.join(MAIN_LEVELS_DIR, filename)
                 dest_path = os.path.join(DEST_DIR, filename)
                 shutil.copy2(src_path, dest_path)
                 print(f"Copied {filename} -> {dest_path}")
                 count += 1

    print(f"\nSuccessfully organized {count} puzzle files into '{DEST_DIR}/'.")

if __name__ == "__main__":
    organize()
