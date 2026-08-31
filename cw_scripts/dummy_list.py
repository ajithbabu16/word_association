import sys
import csv
import json

def create_json_from_csv(input_csv_path, output_json_path, start_id=1001):
    """
    Reads a two-column CSV file (name, profile_id) and converts it into a
    JSON array with a new, auto-incrementing 'pid'.

    Args:
        input_csv_path (str): The path to the source CSV file.
        output_json_path (str): The path where the output JSON file will be saved.
        start_id (int): The starting number for the 'dummy_' pid.
    """
    processed_records = []
    current_id = start_id

    try:
        # Open the input CSV file for reading
        with open(input_csv_path, mode='r', newline='', encoding='utf-8') as csv_file:
            # Create a CSV reader object
            csv_reader = csv.reader(csv_file)

            # Process each row in the CSV
            for row in csv_reader:
                # Skip empty rows to avoid errors
                if not row or len(row) < 2:
                    continue

                # Extract data from columns, stripping any extra whitespace
                name = row[0].strip()
                profile_id = row[1].strip()

                # Create the new dictionary structure
                record = {
                    "pid": f"dummy_{current_id}",
                    "name": name,
                    "profile_id": profile_id
                }

                # Add the new record to our list
                processed_records.append(record)

                # Increment the ID for the next row
                current_id += 1

        # Open the output JSON file for writing
        with open(output_json_path, mode='w', encoding='utf-8') as json_file:
            # Write the list of records to the JSON file with nice formatting
            json.dump(processed_records, json_file, indent=4)

        print(f"✅ Success! Processed {len(processed_records)} records.")
        print(f"   Input: '{input_csv_path}'")
        print(f"   Output saved to: '{output_json_path}'")

    except FileNotFoundError:
        print(f"❌ Error: The file '{input_csv_path}' was not found.")
        print("   Please make sure the CSV file is in the same directory as the script.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


# --- Main execution block ---
if __name__ == "__main__":
    # --- Configuration ---
    # Set the name of your input CSV file here
    input_file = 'csv/dummies.csv'
    # Set the desired name for your output JSON file
    output_file = 'generated/dummies_data.json'

    # Run the conversion function
    create_json_from_csv(input_file, output_file)

