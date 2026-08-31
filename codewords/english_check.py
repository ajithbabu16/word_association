import json
from openai import OpenAI

client = OpenAI()

def iter_level_samples(data, max_chars_per_level=400):
    """
    Yield small samples per level so we don't blow context.
    """
    for level_id, lvl in data.get("puzzles", {}).items():
        phrase = (lvl.get("phrase") or "")[:max_chars_per_level]
        answer = (lvl.get("answer") or "")[:max_chars_per_level]
        yield {"level": str(level_id), "phrase": phrase, "answer": answer}

def chunked(items, chunk_size=10):
    buf = []
    for x in items:
        buf.append(x)
        if len(buf) >= chunk_size:
            yield buf
            buf = []
    if buf:
        yield buf

def check_english(data, chunk_size=10):
    """
    Returns aggregated English quality report.
    """
    issues = []
    scores = []

    for batch in chunked(iter_level_samples(data), chunk_size=chunk_size):
        prompt = (
            "You are validating English quality for a word puzzle game.\n"
            "These strings SHOULD be correct English.\n\n"
            "Flag:\n"
            "- spelling mistakes\n"
            "- missing letters / merged words\n"
            "- unreadable sentences\n"
            "- wrong punctuation spacing\n\n"
            "Return STRICT JSON with keys:\n"
            "{\n"
            '  "quality_score": number (0-100),\n'
            '  "issues": [ { "level": string, "problem": string, "suggested_fix": string } ]\n'
            "}\n\n"
            "DATA:\n"
            f"{json.dumps(batch, ensure_ascii=False)}"
        )

        resp = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
        )

        text = resp.output_text.strip()
        try:
            parsed = json.loads(text)
        except Exception:
            # If model returns non-JSON, capture raw
            issues.append({
                "level": "batch",
                "problem": "Model did not return valid JSON",
                "suggested_fix": text[:800]
            })
            continue

        if isinstance(parsed, dict):
            if "quality_score" in parsed and isinstance(parsed["quality_score"], (int, float)):
                scores.append(float(parsed["quality_score"]))
            for it in parsed.get("issues", []):
                issues.append(it)

    avg_score = sum(scores) / len(scores) if scores else None
    return {
        "avg_quality_score": avg_score,
        "issues_found": len(issues) > 0,
        "issues": issues[:200],  # cap so output doesn't explode
    }
