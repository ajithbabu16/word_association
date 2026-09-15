# Packs CSV to JSON Converter

This standalone folder converts `packslevel.csv` into Cocos pack JSON data structures (`packs_1_v1/Data/data.json` .. `packs_8_v1/Data/data.json`) and packages them automatically into a downloadable zip file (`packs_output.zip`).

## Quick Start

Simply run the Python script without arguments:

```bash
python3 generate_packs.py
```

### What happens automatically:
1. Reads `packslevel.csv` located in this directory.
2. Generates JSON files into the `./output/` directory for each theme:
   - `output/packs_1_v1/Data/data.json` (Aviation)
   - `output/packs_2_v1/Data/data.json` (Music)
   - `output/packs_3_v1/Data/data.json` (Dinosaurs)
   - `output/packs_4_v1/Data/data.json` (Insects)
   - `output/packs_5_v1/Data/data.json` (Food)
   - `output/packs_6_v1/Data/data.json` (Ancient History)
   - `output/packs_7_v1/Data/data.json` (Science)
   - `output/packs_8_v1/Data/data.json` (Camping)
3. Creates a single compressed zip file `packs_output.zip` containing all generated packs, ready to download or deploy.

## Custom Execution Options

You can also pass custom paths if needed:

```bash
python3 generate_packs.py --csv /path/to/custom.csv --output-dir ./custom_output --zip-path ./custom_packs.zip
```
