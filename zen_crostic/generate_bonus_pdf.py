import os
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def generate_pdf():
    base_dir = r"c:\word_association\zen_crostic"
    csv_path = os.path.join(base_dir, "ZenCrosticBonus.csv")
    image_dir = os.path.join(base_dir, "Bonus Puzzle images")
    output_pdf = os.path.join(base_dir, "ZenCrostic_Bonus_Visuals.pdf")
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
        
    df = pd.read_csv(csv_path)
    
    c = canvas.Canvas(output_pdf, pagesize=letter)
    width, height = letter
    
    margin_x = 60
    margin_y = 60
    content_width = width - 2*margin_x
    
    for index, row in df.iterrows():
        level = str(row.get('Level_Number', ''))
        phrase = str(row.get('Phrase', '')).strip()
        
        if pd.isna(row.get('Level_Number')) or not level.strip():
            continue # Skip empty rows
            
        # Draw Level Header
        c.setFont("Helvetica-Bold", 32)
        c.drawString(margin_x, height - margin_y - 40, f"LEVEL {level}")
        
        # Draw Phrase
        c.setFont("Helvetica-Oblique", 18)
        c.drawString(margin_x, height - margin_y - 90, f'"{phrase}"')
        
        # Collect pictures for this level
        pictures = []
        for i in range(1, 11):
            pic_val = row.get(f'Picture {i}')
            if pd.notna(pic_val) and str(pic_val).strip():
                pictures.append(str(pic_val).strip().upper())
                
        if not pictures:
            c.showPage()
            continue
            
        # Draw Images in a grid
        cols = 3
        img_box_size = 130
        gap_x = (content_width - (cols * img_box_size)) / (cols - 1) if cols > 1 else 0
        gap_y = 70 # vertical gap to allow room for the text labels
        
        start_y = height - margin_y - 140 - img_box_size
        
        current_col = 0
        current_row = 0
        
        c.setFont("Helvetica-Bold", 14)
        
        for pic in pictures:
            src_path = os.path.join(image_dir, f"{pic}.png")
            
            x = margin_x + current_col * (img_box_size + gap_x)
            y = start_y - current_row * (img_box_size + gap_y)
            
            if os.path.exists(src_path):
                # Draw the black box
                c.setFillColorRGB(0, 0, 0)
                c.rect(x, y, img_box_size, img_box_size, fill=1, stroke=0)
                
                # Draw the original image with transparency mask
                padding = 15
                c.drawImage(src_path, x + padding, y + padding, width=img_box_size - (padding * 2), height=img_box_size - (padding * 2), mask='auto')
            else:
                # Draw a placeholder box if image doesn't exist
                c.setFillColorRGB(1, 0, 0)  # Red color
                c.rect(x, y, img_box_size, img_box_size, fill=1, stroke=0)
                c.setFillColorRGB(1, 1, 1)  # White text
                c.drawCentredString(x + img_box_size/2, y + img_box_size/2 - 5, "MISSING")
                
            # Reset text color to black
            c.setFillColorRGB(0, 0, 0)
                
            # Draw Picture name centered below the image box
            c.drawCentredString(x + img_box_size/2, y - 25, pic)
            
            current_col += 1
            if current_col >= cols:
                current_col = 0
                current_row += 1
                
        c.showPage() # Create a new page for the next level
        
    c.save()
    print(f"PDF successfully generated: {output_pdf}")

if __name__ == "__main__":
    generate_pdf()
