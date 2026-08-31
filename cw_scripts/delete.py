import sys
import json

def filter_json(input_file, output_file, keep_entries):
    """
    Keep only entries in JSON whose keys are in keep_entries.
    """
    with open(input_file, "r") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError("Expected JSON to be an object (dictionary)")

    # Convert keep_entries to string since keys in JSON are strings
    keep_keys = set(str(x) for x in keep_entries)

    # Keep only required keys
    filtered = {k: v for k, v in data.items() if k in keep_keys}

    # Save filtered JSON
    with open(output_file, "w") as f:
        json.dump(filtered, f, indent=4)

    print(f"✅ Filtered JSON written to {output_file}")


# ---------------- Example Usage ----------------
if __name__ == "__main__":
    input_file = "generated/level_v3_phrases.json"
    output_file = "generated/filtered.json"

    # The numbers you want to keep
    keep_entries = [551, 641, 645, 671, 682, 689, 833, 871, 928]


    filter_json(input_file, output_file, keep_entries)
