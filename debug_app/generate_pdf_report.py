import json
import os
from reportlab.lib.pagesizes import letter, landscape, A3
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from collections import defaultdict

def has_long_word(phrase):
    # Split the phrase by space and check if any individual word >= 10 chars
    words = str(phrase).split()
    for w in words:
        if len(w) >= 10:
            return True
    return False

def extract_long_words_main(json_data, start_level, end_level):
    results = []
    levels = json_data.get("levels", [])
    
    for level in levels:
        level_num = level.get("levelNumber")
        if start_level <= level_num <= end_level:
            long_words = set()
            for group in level.get("groups", []):
                for word in group.get("words", []):
                    if has_long_word(word):
                        long_words.add(str(word))
            
            if long_words:
                results.append((str(level_num), "\n".join(sorted(list(long_words)))))
                
    return results

def extract_long_words_daily(json_data):
    from datetime import datetime, timedelta
    
    level_data = defaultdict(lambda: defaultdict(list))
    
    levels = json_data.get("levels", [])
    for level in levels:
        level_num = level.get("levelNumber")
        stage_num = level.get("stageNumber")
        
        long_words = set()
        for group in level.get("groups", []):
            for word in group.get("words", []):
                if has_long_word(word):
                    long_words.add(str(word))
        
        if long_words:
            level_data[level_num][stage_num].extend(list(long_words))
            
    results = []
    max_stages = 0
    for level_num, stages in level_data.items():
        if stages.keys():
            max_stages = max(max_stages, max(stages.keys()))
            
    start_date = datetime(2026, 6, 26)
            
    for level_num in sorted(level_data.keys()):
        current_date = start_date + timedelta(days=level_num - 1)
        date_str = current_date.strftime("%Y-%m-%d")
        
        row = [str(level_num), date_str]
        stages = level_data[level_num]
        for stage_i in range(1, max_stages + 1):
            if stage_i in stages:
                row.append("\n".join(sorted(stages[stage_i])))
            else:
                row.append("-")
        results.append(row)
        
    return results, max_stages

def create_pdf(filename, data, headers):
    # Use A3 landscape for daily puzzle to fit all columns without overlapping
    pdf = SimpleDocTemplate(filename, pagesize=landscape(A3) if len(headers) > 3 else letter)
    
    styles = getSampleStyleSheet()
    header_style = styles['Normal']
    header_style.textColor = colors.whitesmoke
    header_style.alignment = 1 # Center
    header_style.fontName = 'Helvetica-Bold'
    header_style.fontSize = 10
    
    # Wrap headers in Paragraphs so they can wrap text if needed
    wrapped_headers = [Paragraph(h, header_style) for h in headers]
    
    if len(headers) == 2:
        colWidths = [100, 400]
    else:
        # Give enough space for columns
        colWidths = [60, 80] + [150] * (len(headers) - 2)
        
    table_data = [wrapped_headers] + data
    table = Table(table_data, colWidths=colWidths)
    
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ])
    table.setStyle(style)
    
    elems = [table]
    pdf.build(elems)
    print(f"PDF generated successfully: {filename}")

def main():
    print("Select Puzzle Type:")
    print("1. Main Puzzle")
    print("2. Daily Puzzle")
    
    choice = input("Enter choice (1 or 2): ").strip()
    
    if choice == '1':
        start_level = int(input("Enter level from: "))
        end_level = int(input("Enter level to: "))
        
        filepath = os.path.join("debug_app", "public", "main.json")
        if not os.path.exists(filepath):
            filepath = os.path.join("public", "main.json")
            if not os.path.exists(filepath):
                filepath = "main.json" 
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        results = extract_long_words_main(data, start_level, end_level)
        headers = ["Level", "Words (>=10 chars in a single word)"]
        create_pdf("main_puzzle_report.pdf", results, headers)
        
    elif choice == '2':
        filepath = os.path.join("debug_app", "public", "daily.json")
        if not os.path.exists(filepath):
            filepath = os.path.join("public", "daily.json")
            if not os.path.exists(filepath):
                filepath = "daily.json"
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        results, max_stages = extract_long_words_daily(data)
        
        headers = ["Level", "Date"]
        for i in range(1, max_stages + 1):
            headers.append(f"Stage {i}<br/>Words")
            
        create_pdf("daily_puzzle_report.pdf", results, headers)
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    main()
