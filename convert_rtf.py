import json

def convert_rtf_to_json(rtf_path, json_path):
    with open(rtf_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    lines = content.splitlines()
    json_lines = []
    in_json = False
    
    for line in lines:
        if '"kind":' in line and not in_json:
            in_json = True
            json_lines.append("{")
            
        if in_json:
            cleaned = line.replace('\\{', '{').replace('\\}', '}')
            if cleaned.endswith('\\'):
                cleaned = cleaned[:-1]
            cleaned = cleaned.replace('\\cf0 ', '')
            
            if '"kind":' in line:
                cleaned = cleaned.replace('{', '', 1) 
            
            json_lines.append(cleaned)

    raw_json = "\n".join(json_lines)
    
    last_brace = raw_json.rfind('}')
    if last_brace != -1:
        raw_json = raw_json[:last_brace+1]
        
    try:
        # We need to trim the final extra } if it exists from the RTF ending
        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError:
            raw_json = raw_json.strip()
            if raw_json.endswith('}'):
                raw_json = raw_json[:-1].strip()
            data = json.loads(raw_json)
            
        with open(json_path, 'w', encoding='utf-8') as out:
            json.dump(data, out, indent=2)
        print("Successfully converted and formatted JSON!")
    except Exception as e:
        print(f"Failed to parse JSON: {e}")

if __name__ == '__main__':
    convert_rtf_to_json(r'c:\word_association\daily_json.rtf', r'c:\word_association\debug_app\public\daily.json')
