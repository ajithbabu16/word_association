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

import threading

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

        except Exception as e:
            self._set_headers(500); self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        try:
            if self.path == '/api/list-scripts':
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
