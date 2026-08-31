import json
import argparse
import sys
import os

from logic_validator import validate_data
from english_check import check_english

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="Path to level.json")
    ap.add_argument("--english", action="store_true", help="Also run English quality check via OpenAI")
    ap.add_argument("--chunk-size", type=int, default=10, help="Levels per OpenAI request")
    ap.add_argument("--fail-on-english", action="store_true", help="Exit non-zero if English issues found")
    args = ap.parse_args()

    if not os.path.exists(args.file):
        print(f"File not found: {args.file}")
        sys.exit(2)

    with open(args.file, "r") as f:
        data = json.load(f)

    logic = validate_data(data)

    print(logic)

    report = {
        "file": os.path.basename(args.file),
        "sceneName": data.get("sceneName"),
        "logic": logic,
    }

    if args.english:
        english = check_english(data, chunk_size=args.chunk_size)
        report["english"] = english

    print(json.dumps(report, indent=2, ensure_ascii=False))

    # Exit codes (useful for CI)
    if not logic.get("ok", False):
        sys.exit(1)
    if args.english and args.fail_on_english and report.get("english", {}).get("issues_found", False):
        sys.exit(3)

if __name__ == "__main__":
    main()
