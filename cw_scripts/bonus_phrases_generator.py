import sys
import csv
import json

def generate_bonus_phrases_json(csv_path, output_path):
    phrases = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            if len(row) < 5:
                continue
                
            level_num = row[0].strip()
            phrase = row[1].strip()
            meaning_text = row[4].strip()
            
            # Add main phrase entry
            phrases[level_num] = phrase + "."
            
            # Add meaning entry
            phrases[f"{level_num}_1"] = f"Meaning: {meaning_text}"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(phrases, f, indent=4, ensure_ascii=False)
    
    print(f"✅ Generated bonus phrases JSON: {output_path}")

# Usage
generate_bonus_phrases_json("csv/idioms-300-400.csv", "generated/idioms-300-400.json")