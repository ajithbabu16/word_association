import json
import os

def to_title(s):
    return ' '.join([w.capitalize() for w in str(s).lower().split()])

def main():
    json_path = os.path.join("public", "main.json")
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    image_dir = "puzzle_image"
    if not os.path.exists(image_dir):
        print(f"Error: {image_dir} directory not found.")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Convert all existing filenames to lowercase for case-insensitive matching
    existing_images = [f.lower() for f in os.listdir(image_dir) if f.endswith('.png')]

    levels = data.get("levels", [])
    missing_count = 0

    print("Checking Main Puzzle for missing images...\n")

    for level in levels:
        level_num = level.get("levelNumber")
        for group in level.get("groups", []):
            if group.get("picture") == True:
                c = str(group.get("category", "")).strip()
                if c:
                    candidate1 = f"{to_title(c)}.png".lower()
                    candidate2 = f"{c}.png".lower()
                    
                    if candidate1 not in existing_images and candidate2 not in existing_images:
                        print(f"Level {level_num}: Missing image for category '{c}'")
                        missing_count += 1

    print(f"\nTotal missing images: {missing_count}")

if __name__ == "__main__":
    main()
