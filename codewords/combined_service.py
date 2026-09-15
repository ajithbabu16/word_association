import http.server
import socketserver
import json
import csv
import os
import smtplib
import io
import pandas as pd
import subprocess
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
import zoneinfo
from urllib.parse import urlparse, parse_qs
from sentence_transformers import SentenceTransformer, util

import sqlite3

# --- CONFIGURATION (DEFAULTS) ---
REPORTS_DIR = 'reports'
if not os.path.exists(REPORTS_DIR): os.makedirs(REPORTS_DIR)

EMAIL_SENDER = "ajith@quriousbit.com"
EMAIL_PASSWORD = "aqfs jekg nuaj pqdk" 

SESSION_CONFIGS = {}
DEFAULT_CONFIG = {
    "receivers": ["ajith@quriousbit.com","rajeev@quriousbit.com"],
    "batch_size": 2000,
    "subject_template": "VARIANT FULL REPORT: {report_name} - Loop {loop}, Level {level}",
    "body_template": "Attached is the full cumulative report for session: {report_name}\nCurrent Progress: Loop {loop}, Level {level}.\nTimestamp: {timestamp}"
}

SENTENCE_MODEL_NAME = 'all-MiniLM-L6-v2'
SIMILARITY_THRESHOLD = 0.85
PORT = 8080
IST = zoneinfo.ZoneInfo("Asia/Kolkata")

# --- TRACKING DATE SQLITE DATABASE & EMAIL AUTOMATION ---
TRACKING_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tracking_date.db')

def init_tracking_db():
    conn = sqlite3.connect(TRACKING_DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracking_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            trigger_days_before INTEGER DEFAULT 5,
            trigger_time TEXT DEFAULT '09:00',
            recipient_emails TEXT DEFAULT 'ajith@quriousbit.com, rajeev@quriousbit.com',
            status TEXT DEFAULT 'ACTIVE',
            notes TEXT DEFAULT '',
            last_email_sent TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        cursor.execute("ALTER TABLE tracking_items ADD COLUMN trigger_time TEXT DEFAULT '09:00'")
    except Exception:
        pass
    conn.commit()
    conn.close()

init_tracking_db()

from email.header import Header

def send_tracking_alert_email(name, start_date, end_date, days_remaining, recipient_emails, trigger_time='09:00', is_expired=False):
    try:
        receivers = [r.strip() for r in recipient_emails.split(',') if r.strip()]
        if not receivers:
            receivers = ["ajith@quriousbit.com", "rajeev@quriousbit.com"]
            
        m = MIMEMultipart('alternative')
        
        # 12-hour formatted time for display
        try:
            t_obj = datetime.strptime(trigger_time, "%H:%M")
            trigger_time_formatted = t_obj.strftime("%I:%M %p")
        except:
            trigger_time_formatted = trigger_time

        if is_expired:
            days_overdue = abs(days_remaining)
            subject = f"[QuriousBit Product Team] URGENT EXPIRED ALERT: '{name}' passed end date ({end_date})"
            badge_class = "badge-danger"
            badge_text = "⚠️ URGENT: EXPIRED / OVERDUE"
            alert_message = f"The product item <strong>'{name}'</strong> has exceeded its scheduled end date of <strong>{end_date}</strong> by {days_overdue} day(s). Please review and update the schedule."
            days_status_formatted = f"<span style='color: #dc2626; font-weight: 800;'>🚨 {days_overdue} day(s) overdue</span>"
        else:
            subject = f"[QuriousBit Product Team] Expiry Reminder: '{name}' ends on {end_date} ({days_remaining} day(s) left)"
            badge_class = "badge-warning"
            badge_text = "🔔 REMINDER: ENDING SOON"
            alert_message = f"This is an automated reminder that product item <strong>'{name}'</strong> is ending soon on <strong>{end_date}</strong> ({days_remaining} day(s) remaining)."
            days_status_formatted = f"<span style='color: #d97706; font-weight: 800;'>🔔 {days_remaining} day(s) remaining</span>"

        # Explicit UTF-8 Header encoding to guarantee Subject header is never dropped in SMTP
        m['Subject'] = Header(subject, 'utf-8')
        m['From'] = Header(f"QuriousBit Product Team <{EMAIL_SENDER}>", 'utf-8')
        m['To'] = ", ".join(receivers)

        # Plain text fallback
        plain_body = f"""[QuriousBit Product Team Alert]
Item Name: {name}
Start Date: {start_date}
End Date: {end_date}
Days Status: {'EXPIRED (' + str(abs(days_remaining)) + ' days overdue)' if is_expired else str(days_remaining) + ' days remaining'}
Scheduled Trigger Time: {trigger_time_formatted}
Recipients: {', '.join(receivers)}
"""
        m.attach(MIMEText(plain_body, 'plain', 'utf-8'))

        # Professional HTML Email Body
        html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 24px; }}
  .email-card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
  .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 28px 24px; text-align: center; color: #ffffff; }}
  .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; }}
  .header p {{ margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; }}
  .badge {{ display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 14px; letter-spacing: 0.5px; }}
  .badge-warning {{ background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; }}
  .badge-danger {{ background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }}
  .body-content {{ padding: 28px 24px; }}
  .alert-banner {{ background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; color: #334155; line-height: 1.5; }}
  .details-table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }}
  .details-table td {{ padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }}
  .details-table tr:last-child td {{ border-bottom: none; }}
  .label-col {{ font-weight: 700; color: #64748b; width: 40%; background-color: #f8fafc; border-radius: 6px; }}
  .val-col {{ font-weight: 700; color: #0f172a; }}
  .footer {{ padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600; }}
</style>
</head>
<body>
  <div class="email-card">
    <div class="header">
      <h1>QuriousBit Product Team</h1>
      <p>Automated Feature Expiry & Schedule Tracker</p>
      <div class="badge {badge_class}">{badge_text}</div>
    </div>
    <div class="body-content">
      <div class="alert-banner">
        {alert_message}
      </div>
      <table class="details-table">
        <tr><td class="label-col">Item / Feature Name</td><td class="val-col">{name}</td></tr>
        <tr><td class="label-col">Start Date</td><td class="val-col">📅 {start_date}</td></tr>
        <tr><td class="label-col">End Date</td><td class="val-col" style="color: #e11d48;">📅 {end_date}</td></tr>
        <tr><td class="label-col">Days Status</td><td class="val-col">{days_status_formatted}</td></tr>
        <tr><td class="label-col">Scheduled Trigger Time</td><td class="val-col">⏰ {trigger_time_formatted}</td></tr>
      </table>
    </div>
    <div class="footer">
      Automated Genie Notification Core • QuriousBit Games
    </div>
  </div>
</body>
</html>
"""
        m.attach(MIMEText(html_body, 'html', 'utf-8'))

        s = smtplib.SMTP('smtp.gmail.com', 587)
        s.starttls()
        s.login(EMAIL_SENDER, EMAIL_PASSWORD)
        s.send_message(m)
        s.quit()
        print(f"Tracking alert email sent for '{name}' to {receivers} with subject: {subject}")
        return True
    except Exception as e:
        print(f"Failed to send tracking alert email for '{name}': {e}")
        return False

def tracking_email_scheduler():
    import time
    while True:
        try:
            conn = sqlite3.connect(TRACKING_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, start_date, end_date, trigger_days_before, trigger_time, recipient_emails, status, last_email_sent FROM tracking_items WHERE status != 'COMPLETED'")
            rows = cursor.fetchall()
            
            now_dt = datetime.now(IST)
            today_str = now_dt.strftime("%Y-%m-%d")
            now_time_str = now_dt.strftime("%H:%M")
            now_ts = now_dt.strftime("%Y-%m-%d %H:%M:%S")
            
            for row in rows:
                item_id, name, start_date, end_date, trigger_days, trigger_time, recipients, status, last_email = row
                try:
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                    days_remaining = (end_dt - now_dt.date()).days
                    item_trigger_time = trigger_time if trigger_time else '09:00'
                    
                    if days_remaining < 0:
                        # Expired -> Alert 3x per day (at or past trigger_time, or if last email > 8 hours ago)
                        should_send = False
                        if not last_email:
                            should_send = True
                        else:
                            try:
                                last_dt = datetime.strptime(last_email, "%Y-%m-%d %H:%M:%S")
                                hours_diff = (now_dt.replace(tzinfo=None) - last_dt).total_seconds() / 3600.0
                                if hours_diff >= 8.0:
                                    should_send = True
                            except:
                                if last_email[:10] != today_str:
                                    should_send = True
                        
                        if should_send:
                            if send_tracking_alert_email(name, start_date, end_date, days_remaining, recipients, trigger_time=item_trigger_time, is_expired=True):
                                cursor.execute("UPDATE tracking_items SET status = 'EXPIRED', last_email_sent = ? WHERE id = ?", (now_ts, item_id))
                                conn.commit()
                                
                    elif days_remaining <= trigger_days:
                        # Ending soon -> Trigger once per day when current time >= trigger_time
                        if now_time_str >= item_trigger_time:
                            if not last_email or last_email[:10] != today_str:
                                if send_tracking_alert_email(name, start_date, end_date, days_remaining, recipients, trigger_time=item_trigger_time, is_expired=False):
                                    cursor.execute("UPDATE tracking_items SET status = 'ENDING_SOON', last_email_sent = ? WHERE id = ?", (now_ts, item_id))
                                    conn.commit()
                                
                except Exception as ex:
                    print(f"Error checking tracking item {item_id}: {ex}")
                    
            conn.close()
        except Exception as e:
            print(f"Error in tracking scheduler: {e}")
        time.sleep(60) # Check every 60 seconds for precise time triggers

import threading
threading.Thread(target=tracking_email_scheduler, daemon=True).start()

model = None
def init_model():
    global model
    try:
        print(f"Loading Sentence Transformer: {SENTENCE_MODEL_NAME}...")
        model = SentenceTransformer(SENTENCE_MODEL_NAME)
        print("Model ready.")
    except Exception as e:
        print("Model failed to load:", e)

threading.Thread(target=init_model, daemon=True).start()


def parse_validation_results(file_path):
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            return None
        elif ext == '.csv':
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except:
                df = pd.read_csv(file_path, encoding='cp1252')
        else:
            df = pd.read_excel(file_path)
            
        df = df.fillna('')
        
        total_puzzles = len(df)
        passed_count = 0
        failed_count = 0
        errors_list = []
        error_categories = {
            "Lock Logic": 0,
            "Cleanliness / Forbidden Chars": 0,
            "Structural / Length": 0,
            "Capitalization": 0,
            "Character Mismatches": 0,
            "Duplication": 0,
            "Missing Letters": 0,
            "Other": 0
        }
        
        for idx, row in df.iterrows():
            level_no = row.get('Level_Number', row.get('Level', idx + 1))
            phrase = str(row.get('Phrase', row.get('Answer', '')))
            row_has_error = False
            
            for col in df.columns:
                val = str(row[col]).strip()
                if not val or val == 'Pass' or val == 'No Duplicates' or 'With Spaces' in col or 'Without Spaces' in col:
                    continue
                    
                if 'Validation' in col or 'Status' in col or 'Check' in col or col == 'Missing Letters':
                    if val != 'Pass' and val != '':
                        row_has_error = True
                        err_parts = [e.strip() for e in val.split(';') if e.strip() and e.strip() != 'Pass']
                        for err in err_parts:
                            cat = "Other"
                            err_lower = err.lower()
                            if 'lock' in err_lower:
                                cat = "Lock Logic"
                            elif 'forbidden' in err_lower or 'quote' in err_lower or 'period' in err_lower:
                                cat = "Cleanliness / Forbidden Chars"
                            elif 'length' in err_lower or 'exceeds' in err_lower or 'structural' in err_lower:
                                cat = "Structural / Length"
                            elif 'capitalization' in err_lower or 'capitalized' in err_lower:
                                cat = "Capitalization"
                            elif 'mismatch' in err_lower or 'invalid character' in err_lower:
                                cat = "Character Mismatches"
                            elif 'dup' in err_lower or 'duplicate' in err_lower:
                                cat = "Duplication"
                            elif 'missing' in err_lower:
                                cat = "Missing Letters"
                                
                            error_categories[cat] = error_categories.get(cat, 0) + 1
                            errors_list.append({
                                "level": str(level_no),
                                "phrase": phrase,
                                "column": col,
                                "error": err,
                                "category": cat
                            })
                            
            if row_has_error:
                failed_count += 1
            else:
                passed_count += 1
                
        pass_rate = round((passed_count / total_puzzles * 100), 1) if total_puzzles > 0 else 0
        
        return {
            "total_puzzles": total_puzzles,
            "passed_puzzles": passed_count,
            "failed_puzzles": failed_count,
            "pass_rate": pass_rate,
            "errors": errors_list,
            "categories": error_categories
        }
    except Exception as e:
        print(f"Error parsing validation results: {e}")
        return None


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

class CombinedHandler(http.server.SimpleHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self): self._set_headers()

    def do_POST(self):
        try:
            if self.path == '/api/run-script':
                import uuid, base64
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                script_name = data.get('script')
                filename = data.get('filename', 'temp.csv')
                b64content = data.get('content')
                
                if not b64content or not script_name:
                    raise Exception("Missing script or content")
                    
                if ',' in b64content:
                    b64content = b64content.split(',')[1]
                    
                file_bytes = base64.b64decode(b64content)
                script_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cw_scripts')
                script_path = os.path.join(script_dir, script_name)
                
                if not os.path.exists(script_path):
                    raise Exception("Script not found")
                
                ext = os.path.splitext(filename)[1]
                uid = str(uuid.uuid4())
                temp_in = os.path.join(script_dir, f"temp_{uid}{ext}")
                temp_out = os.path.join(script_dir, f"out_{uid}.json")
                
                with open(temp_in, 'wb') as f:
                    f.write(file_bytes)
                
                try:
                    res = subprocess.run(['python', script_name, temp_in, temp_out], cwd=script_dir, capture_output=True, text=True)
                    if res.returncode != 0:
                        raise Exception(f"Script failed: {res.stderr}\nOutput: {res.stdout}")
                        
                    if not os.path.exists(temp_out):
                        raise Exception("Script did not generate the output JSON file. Check script sys.argv handling.")
                        
                    with open(temp_out, 'r', encoding='utf-8') as f:
                        result_json = json.load(f)
                        
                    self._set_headers()
                    self.wfile.write(json.dumps({"status": "success", "data": result_json}).encode())
                finally:
                    if os.path.exists(temp_in): os.remove(temp_in)
                    if os.path.exists(temp_out): os.remove(temp_out)

            elif self.path == '/api/convert-json':
                import uuid, base64
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                puzzle_type = data.get('puzzle_type', 'main')
                filename = data.get('filename', 'input.csv')
                b64content = data.get('content')
                
                if not b64content:
                    raise Exception("Missing file content for JSON conversion")
                    
                if ',' in b64content:
                    b64content = b64content.split(',')[1]
                    
                file_bytes = base64.b64decode(b64content)
                zen_auto = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'zen_crostic', 'Automation')
                
                if puzzle_type == 'bonus':
                    script_name = 'generate_bonus_levels_json.py'
                elif puzzle_type == 'daily':
                    script_name = 'generate_daily_puzzle_json.py'
                elif puzzle_type == 'packs':
                    script_name = 'generate_packs_json.py'
                else:
                    script_name = 'generate_crostics_level_v1_json.py'
                    
                script_path = os.path.join(zen_auto, script_name)
                
                if not os.path.exists(script_path):
                    raise Exception(f"Conversion script {script_name} not found in {zen_auto}")
                    
                uid = str(uuid.uuid4())
                ext = os.path.splitext(filename)[1] or '.csv'
                temp_in = os.path.join(zen_auto, f"temp_conv_{uid}{ext}")
                temp_out = os.path.join(zen_auto, f"temp_out_{uid}.json")
                
                with open(temp_in, 'wb') as f:
                    f.write(file_bytes)
                    
                try:
                    res = subprocess.run(['python', script_name, temp_in, temp_out], cwd=zen_auto, capture_output=True, text=True)
                    if res.returncode != 0:
                        raise Exception(f"Conversion script failed:\n{res.stderr or res.stdout}")
                        
                    if not os.path.exists(temp_out):
                        raise Exception("Conversion script executed but output JSON was not generated.")
                        
                    with open(temp_out, 'r', encoding='utf-8') as f:
                        result_json = json.load(f)
                        
                    self._set_headers()
                    self.wfile.write(json.dumps({"status": "success", "data": result_json, "message": res.stdout}).encode())
                finally:
                    if os.path.exists(temp_in): os.remove(temp_in)
                    if os.path.exists(temp_out): os.remove(temp_out)
                    
            elif self.path == '/configure':
                content_length = int(self.headers['Content-Length'])
                new_config = json.loads(self.rfile.read(content_length))
                name = new_config.get('reportName', 'default')
                if name not in SESSION_CONFIGS: SESSION_CONFIGS[name] = DEFAULT_CONFIG.copy()
                conf = SESSION_CONFIGS[name]
                if 'emails' in new_config: conf['receivers'] = new_config['emails']
                if 'batchSize' in new_config: conf['batch_size'] = int(new_config['batchSize'])
                if 'subject' in new_config: conf['subject_template'] = new_config['subject']
                if 'body' in new_config: conf['body_template'] = new_config['body']
                if new_config.get('reportMode') in ['reset', 'new']:
                    csv_p, state_p = self.get_paths(name)
                    if os.path.exists(csv_p): os.remove(csv_p)
                    if os.path.exists(state_p): os.remove(state_p)
                self._set_headers()
                self.wfile.write(json.dumps({"status": "updated", "session": name}).encode())

            elif self.path == '/api/zen-crostic-run':
                import uuid, base64, shutil
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                script_name = data.get('script')
                filename = data.get('filename')
                b64content = data.get('content')
                images = data.get('images', [])
                
                if not script_name or not b64content:
                    raise Exception("Missing script or file content")
                
                zen_base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'zen_crostic')
                master_script = os.path.join(zen_base, script_name)
                if not os.path.exists(master_script):
                    raise Exception(f"Script {script_name} not found in zen_crostic")
                
                # Create isolated run directory
                uid = str(uuid.uuid4())
                run_dir = os.path.join(zen_base, f"temp_run_{uid}")
                os.makedirs(run_dir, exist_ok=True)
                
                # Output directory for validators
                os.makedirs(os.path.join(run_dir, "output"), exist_ok=True)
                
                try:
                    # Write input file
                    in_path = os.path.join(run_dir, filename)
                    with open(in_path, 'wb') as f:
                        f.write(base64.b64decode(b64content))
                        
                    # Also write it as ZenCrosticBonus.csv / ZenCrost.csv etc depending on script so hardcoded fallbacks work
                    if "Bonus" in script_name or "bonus" in script_name:
                        with open(os.path.join(run_dir, "ZenCrosticBonus" + os.path.splitext(filename)[1]), 'wb') as f:
                            f.write(base64.b64decode(b64content))
                    else:
                        with open(os.path.join(run_dir, "ZenCrost" + os.path.splitext(filename)[1]), 'wb') as f:
                            f.write(base64.b64decode(b64content))
                    
                    # Write images if provided
                    if images:
                        img_dir = os.path.join(run_dir, "Bonus Puzzle images")
                        os.makedirs(img_dir, exist_ok=True)
                        for img in images:
                            try:
                                img_name = os.path.basename(img['name'].replace('\\', '/'))
                                with open(os.path.join(img_dir, img_name), 'wb') as f:
                                    f.write(base64.b64decode(img['content']))
                            except Exception as img_e:
                                print(f"Failed to write image {img['name']}: {img_e}")
                    
                    # Copy the script and patch the base_dir to point to this isolated folder
                    patched_script = os.path.join(run_dir, "run_" + script_name)
                    with open(master_script, 'r', encoding='utf-8') as f:
                        script_code = f.read()
                    
                    # Patch base_dir hardcodings safely using repr(run_dir)
                    # We use a lambda to avoid backslash escape processing in re.sub replacement string
                    script_code = re.sub(r'base_dir\s*=\s*r?["\'].*?zen_crostic["\']', lambda m: f'base_dir = r"{run_dir}"', script_code)
                    
                    with open(patched_script, 'w', encoding='utf-8') as f:
                        f.write(script_code)
                    
                    # Execute
                    # Pass the filename so scripts that parse sys.argv[1] can use it
                    res = subprocess.run(['python', "run_" + script_name, filename], cwd=run_dir, capture_output=True, text=True)
                    if res.returncode != 0:
                        raise Exception(f"Script failed: {res.stderr}\nOutput: {res.stdout}")
                        
                    # Find output
                    # Validators write to run_dir/output/...
                    # PDF generator writes to run_dir/ZenCrostic_Bonus_Visuals.pdf
                    output_file_path = None
                    out_dir = os.path.join(run_dir, "output")
                    if os.path.exists(out_dir):
                        files = os.listdir(out_dir)
                        if files:
                            # get the most recently created file
                            output_file_path = max([os.path.join(out_dir, f) for f in files], key=os.path.getctime)
                            
                    if not output_file_path:
                        # Check root run_dir for PDF
                        files = [f for f in os.listdir(run_dir) if f.endswith('.pdf')]
                        if files:
                            output_file_path = os.path.join(run_dir, files[0])
                            
                    if not output_file_path or not os.path.exists(output_file_path):
                        raise Exception(f"Script succeeded but no output file found. Output log: {res.stdout}")
                        
                    with open(output_file_path, 'rb') as f:
                        out_bytes = f.read()
                        
                    out_b64 = base64.b64encode(out_bytes).decode('utf-8')
                    parsed_analysis = parse_validation_results(output_file_path)
                    
                    self._set_headers()
                    self.wfile.write(json.dumps({
                        "status": "success", 
                        "output_filename": os.path.basename(output_file_path),
                        "output_content": out_b64,
                        "analysis": parsed_analysis
                    }).encode())
                finally:
                    # Cleanup
                    try:
                        shutil.rmtree(run_dir)
                    except Exception as e:
                        print(f"Warning: Failed to cleanup {run_dir}: {e}")

            elif self.path == '/log':
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                name = data.get('reportName', 'default')
                loop, level = self.log_to_csv(data, name)
                conf = SESSION_CONFIGS.get(name, DEFAULT_CONFIG)
                if level > 0 and level % conf['batch_size'] == 0:
                    self.send_report_email(level, loop, name, conf)
                self._set_headers()
                self.wfile.write(json.dumps({"status": "logged", "loop": loop, "level": level}).encode())

            elif self.path == '/api/tracking-dates/add':
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                conn = sqlite3.connect(TRACKING_DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO tracking_items (name, start_date, end_date, trigger_days_before, trigger_time, recipient_emails, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        data.get('name', 'Unnamed Item'),
                        data.get('start_date', datetime.now(IST).strftime("%Y-%m-%d")),
                        data.get('end_date', datetime.now(IST).strftime("%Y-%m-%d")),
                        int(data.get('trigger_days_before', 5)),
                        data.get('trigger_time', '09:00'),
                        data.get('recipient_emails', 'ajith@quriousbit.com, rajeev@quriousbit.com'),
                        data.get('notes', ''),
                        data.get('status', 'ACTIVE')
                    )
                )
                conn.commit()
                new_id = cursor.lastrowid
                conn.close()
                self._set_headers()
                self.wfile.write(json.dumps({"status": "success", "id": new_id}).encode())

            elif self.path == '/api/tracking-dates/update':
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                conn = sqlite3.connect(TRACKING_DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE tracking_items SET name=?, start_date=?, end_date=?, trigger_days_before=?, trigger_time=?, recipient_emails=?, notes=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    (
                        data.get('name'),
                        data.get('start_date'),
                        data.get('end_date'),
                        int(data.get('trigger_days_before', 5)),
                        data.get('trigger_time', '09:00'),
                        data.get('recipient_emails'),
                        data.get('notes', ''),
                        data.get('status', 'ACTIVE'),
                        int(data.get('id'))
                    )
                )
                conn.commit()
                conn.close()
                self._set_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())

            elif self.path == '/api/tracking-dates/delete':
                content_length = int(self.headers.get('Content-Length', 0))
                item_id = None
                if content_length > 0:
                    data = json.loads(self.rfile.read(content_length))
                    item_id = data.get('id')
                else:
                    query = parse_qs(urlparse(self.path).query)
                    item_id = query.get('id', [None])[0]
                
                if item_id:
                    conn = sqlite3.connect(TRACKING_DB_PATH)
                    cursor = conn.cursor()
                    cursor.execute("DELETE FROM tracking_items WHERE id=?", (int(item_id),))
                    conn.commit()
                    conn.close()
                self._set_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())

            elif self.path == '/api/tracking-dates/send-now':
                content_length = int(self.headers['Content-Length'])
                data = json.loads(self.rfile.read(content_length))
                item_id = data.get('id')
                conn = sqlite3.connect(TRACKING_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, start_date, end_date, trigger_days_before, trigger_time, recipient_emails, status FROM tracking_items WHERE id=?", (int(item_id),))
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    item_id, name, start_date, end_date, trigger_days, item_trigger_time, recipients, status = row
                    today = datetime.now(IST).date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                    days_remaining = (end_dt - today).days
                    is_expired = days_remaining < 0
                    sent = send_tracking_alert_email(name, start_date, end_date, days_remaining, recipients, trigger_time=item_trigger_time, is_expired=is_expired)
                    self._set_headers()
                    self.wfile.write(json.dumps({"status": "success" if sent else "error", "sent": sent}).encode())
                else:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": "Item not found"}).encode())

        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        try:
            if self.path == '/api/tracking-dates':
                conn = sqlite3.connect(TRACKING_DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, start_date, end_date, trigger_days_before, trigger_time, recipient_emails, status, notes, last_email_sent, created_at, updated_at FROM tracking_items ORDER BY end_date ASC")
                rows = cursor.fetchall()
                conn.close()
                
                today = datetime.now(IST).date()
                items = []
                for row in rows:
                    item = dict(row)
                    try:
                        end_dt = datetime.strptime(item['end_date'], "%Y-%m-%d").date()
                        item['days_remaining'] = (end_dt - today).days
                    except:
                        item['days_remaining'] = 0
                    
                    if item['status'] != 'COMPLETED':
                        if item['days_remaining'] < 0:
                            item['calculated_status'] = 'EXPIRED'
                        elif item['days_remaining'] <= item['trigger_days_before']:
                            item['calculated_status'] = 'ENDING_SOON'
                        else:
                            item['calculated_status'] = 'ACTIVE'
                    else:
                        item['calculated_status'] = 'COMPLETED'
                        
                    items.append(item)
                    
                self._set_headers()
                self.wfile.write(json.dumps({"status": "success", "items": items}).encode())

            elif self.path == '/api/list-scripts':
                script_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cw_scripts')
                if not os.path.exists(script_dir):
                    scripts = []
                else:
                    scripts = [f for f in os.listdir(script_dir) if f.endswith('.py')]
                self._set_headers()
                self.wfile.write(json.dumps({"scripts": scripts}).encode())

            elif self.path.startswith('/view-report'):
                query = parse_qs(urlparse(self.path).query)
                name = query.get('name', [''])[0]
                csv_path, _ = self.get_paths(name)
                
                if not os.path.exists(csv_path):
                    self.send_response(404)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b"<h1>Report not found</h1>")
                    return
                
                try:
                    df = pd.read_csv(csv_path, encoding='utf-16', on_bad_lines='skip')
                except:
                    try:
                        df = pd.read_csv(csv_path, encoding='utf-8', on_bad_lines='skip')
                    except Exception as e:
                        self.send_response(500)
                        self.send_header('Content-type', 'text/html')
                        self.end_headers()
                        self.wfile.write(f"<h1>Error reading report: {e}</h1>".encode())
                        return

                html_table = df.to_html(classes='glass-table', index=False)
                
                html_content = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Live Report: {name}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&display=swap" rel="stylesheet">
                    <style>
                        body {{
                            background-color: #0b0914;
                            color: #fff;
                            font-family: 'Outfit', sans-serif;
                            padding: 2rem;
                        }}
                        h1 {{
                            color: #00f5d4;
                            text-align: center;
                        }}
                        .table-container {{
                            overflow-x: auto;
                            background: rgba(15, 12, 29, 0.65);
                            backdrop-filter: blur(10px);
                            border-radius: 12px;
                            padding: 1rem;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                        }}
                        .glass-table {{
                            width: 100%;
                            border-collapse: collapse;
                        }}
                        .glass-table th, .glass-table td {{
                            padding: 12px;
                            text-align: left;
                            border-bottom: 1px solid rgba(255,255,255,0.1);
                        }}
                        .glass-table th {{
                            background: rgba(157, 78, 221, 0.2);
                            color: #fff;
                        }}
                    </style>
                </head>
                <body>
                    <h1>Report: {name}</h1>
                    <div class="table-container">
                        {html_table}
                    </div>
                </body>
                </html>
                """
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(html_content.encode())

            elif self.path.startswith('/download-report'):
                query = parse_qs(urlparse(self.path).query)
                name = query.get('name', [''])[0]
                csv_path, _ = self.get_paths(name)
                
                if not os.path.exists(csv_path):
                    self.send_response(404)
                    self.send_header('Content-type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(b"Report not found on server.")
                    return
                    
                self.send_response(200)
                self.send_header('Content-type', 'text/csv')
                self.send_header('Content-Disposition', f'attachment; filename="{os.path.basename(csv_path)}"')
                self.end_headers()
                
                with open(csv_path, 'rb') as f:
                    self.wfile.write(f.read())
                    
            elif self.path == '/list-reports':
                reports = [f.replace('.csv', '') for f in os.listdir(REPORTS_DIR) if f.endswith('.csv')]
                self._set_headers(); self.wfile.write(json.dumps({"reports": sorted(list(set(reports)))}).encode())
            
            elif self.path == '/adb-devices':
                output = subprocess.check_output(['adb', 'devices']).decode()
                devices = []
                for line in output.splitlines()[1:]:
                    if 'device' in line:
                        did = line.split()[0]
                        model_name = subprocess.check_output(['adb', '-s', did, 'shell', 'getprop', 'ro.product.model']).decode().strip()
                        devices.append({"id": did, "model": model_name})
                self._set_headers(); self.wfile.write(json.dumps({"status": "success", "devices": devices}).encode())

            elif self.path.startswith('/adb-packages'):
                query = parse_qs(urlparse(self.path).query)
                qid = query.get('device_id', [''])[0]
                output = subprocess.check_output(['adb', '-s', qid, 'shell', 'pm', 'list', 'packages']).decode()
                pkgs = [l.replace('package:', '').strip() for l in output.splitlines() if l.startswith('package:')]
                self._set_headers(); self.wfile.write(json.dumps({"packages": pkgs}).encode())

            elif self.path.startswith('/adb-profiler-all'):
                query = parse_qs(urlparse(self.path).query)
                device_id = query.get('device_id', [''])[0]
                package = query.get('package', [''])[0]
                pid = subprocess.check_output(['adb', '-s', device_id, 'shell', 'pidof', package]).decode().strip()
                
                # 1. CPU & System
                sys_cpu = 0.0
                try:
                    sys_out = subprocess.check_output(['adb', '-s', device_id, 'shell', 'top', '-n', '1', '-b']).decode()
                    m = re.search(r'(\d+)%\s*user,\s*(\d+)%\s*sys', sys_out.lower())
                    if m: sys_cpu = float(m.group(1)) + float(m.group(2))
                except: pass

                # 2. Threads
                cpu_out = subprocess.check_output(['adb', '-s', device_id, 'shell', 'top', '-n', '1', '-b', '-H', '-p', pid]).decode()
                threads = []
                app_cpu = 0.0
                state_map = {"R": "Running", "S": "Sleeping", "D": "Waiting"}
                for line in cpu_out.splitlines():
                    p = line.split()
                    if len(p) >= 9 and p[0].isdigit():
                        threads.append({"tid": p[0], "name": p[-1], "cpu": float(p[8].replace(',','.')), "state": p[7], "state_label": state_map.get(p[7], "Sleeping")})
                        if p[0] == pid: app_cpu = float(p[8].replace(',','.'))

                # 3. Memory
                mem_out = subprocess.check_output(['adb', '-s', device_id, 'shell', 'dumpsys', 'meminfo', package]).decode()
                def get_val(label, txt):
                    m = re.search(label + r':?\s*(\d+)', txt, re.I)
                    return int(m.group(1)) if m else 0

                # 4. Thermal & Events
                thermal = "Nominal"
                event = None
                try:
                    therm_out = subprocess.check_output(['adb', '-s', device_id, 'shell', 'dumpsys', 'thermalservice']).decode()
                    m = re.search(r'status:\s*(\d+)', therm_out.lower())
                    if m: thermal = m.group(1)
                    log_out = subprocess.check_output(['adb', '-s', device_id, 'shell', 'logcat', '-d', '-t', '50', '-s', 'ActivityTaskManager:I']).decode()
                    for l in reversed(log_out.splitlines()):
                        if "DISPLAYed" in l or "RESUME" in l:
                            m = re.search(r'\{(.*?)\}', l)
                            if m: event = m.group(1).split("/")[-1].split()[0]; break
                except: pass

                self._set_headers()
                self.wfile.write(json.dumps({
                    "status": "success", "pid": pid, "cpu": {"total": app_cpu, "system": sys_cpu, "threads": sorted(threads, key=lambda x: x['cpu'], reverse=True)[:50]},
                    "memory": {"pss": get_val("TOTAL PSS", mem_out) or get_val("TOTAL", mem_out), "java": get_val("Java Heap", mem_out), "native": get_val("Native Heap", mem_out), "code": get_val("Code:", mem_out), "stack": get_val("Stack:", mem_out), "private_other": get_val("Private Other:", mem_out)},
                    "system_health": {"thermal": thermal, "event": event},
                    "leak_stats": {"fd_count": 0, "views": get_val("Views", mem_out), "activities": get_val("Activities", mem_out)}
                }).encode())

            elif self.path.startswith('/adb-gc'):
                query = parse_qs(urlparse(self.path).query)
                subprocess.run(['adb', '-s', query['device_id'][0], 'shell', 'kill', '-10', f"$(adb -s {query['device_id'][0]} shell pidof {query['package'][0]})"])
                self._set_headers(); self.wfile.write(json.dumps({"status": "success"}).encode())

            elif self.path.startswith('/adb-trace'):
                query = parse_qs(urlparse(self.path).query)
                qid = query['device_id'][0]
                subprocess.run(['adb', '-s', qid, 'shell', 'atrace', '--async_start', 'sched', 'gfx', 'view'])
                import time; time.sleep(5)
                trace = subprocess.check_output(['adb', '-s', qid, 'shell', 'atrace', '--async_stop']).decode()
                self._set_headers(); self.wfile.write(json.dumps({"status": "success", "preview": trace[:500]}).encode())

            else: super().do_GET()
        except Exception as e:
            self._set_headers(500); self.wfile.write(json.dumps({"error": str(e)}).encode())

    def get_paths(self, name):
        s = "".join(x for x in name if x.isalnum() or x in "._- ")
        return os.path.join(REPORTS_DIR, f"{s}.csv"), os.path.join(REPORTS_DIR, f"{s}_state.json")

    def get_state(self, path):
        if os.path.exists(path):
            with open(path, 'r') as f: return json.load(f)
        return {"current_loop": 1, "last_logged_level": 0}

    def save_state(self, path, state):
        with open(path, 'w') as f: json.dump(state, f)

    def log_to_csv(self, data, name):
        lv = int(data.get('level', 0))
        cp, sp = self.get_paths(name)
        st = self.get_state(sp)
        now = datetime.now(IST)
        if lv == 1 and st["last_logged_level"] > 1:
            with open(cp, 'a', newline='', encoding='utf-16') as f:
                csv.writer(f).writerow(['---', '---', f'LOOP {st["current_loop"]} ENDED', '---', '---', '---', '---'])
            st["current_loop"] += 1
        st["last_logged_level"] = lv
        self.save_state(sp, st)
        exists = os.path.isfile(cp)
        with open(cp, 'a', newline='', encoding='utf-16') as f:
            w = csv.writer(f)
            if not exists: w.writerow(['Loop', 'Level', 'Phrase/Sentence', 'Status', 'Reason', 'Date (IST)', 'Time (IST)'])
            w.writerow([st["current_loop"], lv, data.get('sentence'), data.get('status'), data.get('reason'), now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")])
        return st["current_loop"], lv

    def send_report_email(self, level, loop, name, conf):
        try:
            m = MIMEMultipart()
            m['From'], m['To'] = EMAIL_SENDER, ", ".join(conf['receivers'])
            m['Subject'] = conf['subject_template'].format(report_name=name, loop=loop, level=level)
            m.attach(MIMEText(conf['body_template'].format(report_name=name, loop=loop, level=level, timestamp=datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')), 'plain'))
            cp, _ = self.get_paths(name)
            if os.path.exists(cp):
                with open(cp, "rb") as f:
                    p = MIMEBase("application", "octet-stream"); p.set_payload(f.read()); encoders.encode_base64(p)
                    p.add_header("Content-Disposition", f"attachment; filename= {os.path.basename(cp)}"); m.attach(p)
            s = smtplib.SMTP('smtp.gmail.com', 587); s.starttls(); s.login(EMAIL_SENDER, EMAIL_PASSWORD); s.send_message(m); s.quit()
        except: pass

if __name__ == '__main__':
    print(f"Genie Multi-Reporter listening on {PORT}...")
    server = ThreadingHTTPServer(('', PORT), CombinedHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()
