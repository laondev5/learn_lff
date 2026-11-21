"""Match FAMILY CLASS QUESTIONS fills to lecture transcripts (v4).

Each question is matched to the transcript segment that best covers its content
words (rare words weighted higher). The blank is then read out of that segment:
handles blanks at the start and end of a question as well as in the middle, and
keeps the transcript timestamp + sentence as evidence.

Reads:  scripts/family-questions.json, ../transcripts/NN.json
Writes: scripts/family-questions-answers.json
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parent.parent
TRANSCRIPTS = ROOT / "transcripts"
QUESTIONS = PROJECT / "scripts" / "family-questions.json"
OUT = PROJECT / "scripts" / "family-questions-answers.json"
LESSON_MAP = PROJECT / ".local-video-map.json"

STOP = set("""a an the and or but if then than that this these those of to in on at by for with from into
as is are was were be been being it its his her their our your my we you he she they i him them us not no
so such which who whom what when where why how all any both each few more most other some only own same too
very can will just should now upon about over under again further once here there also because while against
between during before after above below off out up down has have had do does did doing shall may might must
one ones""".split())


def norm(word):
    word = unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode()
    word = re.sub(r"[^a-z0-9']", "", word.lower()).strip("'")
    if len(word) > 4 and word.endswith("ies"):
        word = word[:-3] + "y"
    elif len(word) > 4 and word.endswith("es"):
        word = word[:-1]
    elif len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        word = word[:-1]
    return word


def words(text):
    return [norm(w) for w in re.findall(r"[A-Za-z0-9']+", text) if norm(w)]


def similar(a, b):
    if a == b:
        return True
    if not a or not b or min(len(a), len(b)) < 4:
        return False
    if a[:4] != b[:4]:
        return False
    return abs(len(a) - len(b)) <= 2


def load_lessons():
    lesson_for_file = {}
    for lesson_id, path in json.loads(LESSON_MAP.read_text(encoding="utf8")).items():
        lesson_for_file[Path(path).name.lower()] = lesson_id
    lessons = []
    for f in sorted(TRANSCRIPTS.glob("*.json")):
        if not re.fullmatch(r"\d+\.json", f.name):
            continue
        data = json.loads(f.read_text(encoding="utf8"))
        video = Path(data.get("video", "")).name.lower()
        segments = []
        for seg in data["segments"]:
            toks = [
                {"n": norm(raw), "raw": raw, "t": seg["start"]}
                for raw in re.findall(r"[A-Za-z0-9']+", seg["text"])
            ]
            if toks:
                segments.append({"t": seg["start"], "text": seg["text"], "tokens": toks})
        lessons.append(
            {
                "file": f.name,
                "title": data.get("title") or video,
                "segments": segments,
                "lessonId": lesson_for_file.get(video),
            }
        )
    return lessons


def build_idf(lessons):
    df = {}
    total = 0
    for lesson in lessons:
        for seg in lesson["segments"]:
            total += 1
            for w in {t["n"] for t in seg["tokens"]}:
                df[w] = df.get(w, 0) + 1
    return {w: math.log((total + 1) / (c + 0.5)) for w, c in df.items()}, df


def segment_score(q_terms, seg, idf):
    if not q_terms:
        return 0.0
    seg_norm = [t["n"] for t in seg["tokens"]]
    hit = 0.0
    miss = 0.0
    for term, weight in q_terms.items():
        if any(similar(term, w) for w in seg_norm):
            hit += weight
        else:
            miss += weight
    return hit / (hit + miss) if hit + miss else 0.0


def question_terms(text):
    flat = words(text)
    terms = {}
    for w in flat:
        if w in STOP or len(w) < 3:
            continue
        terms[w] = terms.get(w, 0.0) + 1.0
    return terms


def find_gap(seg_tokens, left, right):
    """Find (start,end) index pair in seg_tokens bounding the missing words."""
    if left and right:
        for i in range(len(seg_tokens) - 1, -1, -1):
            if not similar(left[-1], seg_tokens[i]["n"]):
                continue
            for j in range(i + 1, min(len(seg_tokens), i + 7)):
                if not similar(right[0], seg_tokens[j]["n"]):
                    continue
                # verify a little more context when available
                ok_left = sum(
                    1
                    for k, w in enumerate(reversed(left[-3:]))
                    if i - 1 - k >= 0 and similar(w, seg_tokens[i - 1 - k]["n"])
                )
                ok_right = sum(
                    1
                    for k, w in enumerate(right[1:3])
                    if j + 1 + k < len(seg_tokens) and similar(w, seg_tokens[j + 1 + k]["n"])
                )
                return i, j, ok_left + ok_right
        return None
    if right:
        # blank at the start: answer is the leading content words
        start = 0
        while start < len(seg_tokens) and seg_tokens[start]["n"] in STOP:
            start += 1
        for j in range(1, min(len(seg_tokens), start + 5)):
            if similar(right[0], seg_tokens[j]["n"]):
                return start - 1, j, 0
        return None
    if left:
        end = len(seg_tokens) - 1
        while end >= 0 and seg_tokens[end]["n"] in STOP:
            end -= 1
        for i in range(end, max(-1, end - 5), -1):
            if similar(left[-1], seg_tokens[i]["n"]):
                return i, end + 1, 0
        return None
    return None


def extract(text, lessons, idf):
    parts = re.split(r"_{2,}", text)
    q_words = [words(p) for p in parts]
    q_terms = question_terms(text)
    best = None
    for lesson in lessons:
        for seg in lesson["segments"]:
            s = segment_score(q_terms, seg, idf)
            if best is None or s > best[0]:
                best = (s, lesson, seg)
    if best is None or best[0] < 0.45:
        return {
            "lesson": None,
            "lessonTitle": None,
            "score": round(best[0], 3) if best else 0,
            "blanks": [None] * max(1, len(parts) - 1),
            "filled": 0,
            "total": max(1, len(parts) - 1),
        }
    score, lesson, seg = best
    toks = seg["tokens"]
    blanks = []
    for idx in range(len(parts) - 1):
        left = [w for w in q_words[idx]][-4:]
        right = [w for w in q_words[idx + 1]][:4]
        gap = find_gap(toks, left, right)
        if gap is None:
            blanks.append(None)
            continue
        i, j, extra = gap
        if j <= i:
            blanks.append(None)
            continue
        raw = [t["raw"] for t in toks[i + 1 : j]]
        if not raw:
            blanks.append(None)
            continue
        blanks.append(
            {
                "answer": " ".join(raw),
                "time": round(toks[i]["t"] if i >= 0 else seg["t"], 1),
                "quote": seg["text"],
                "evidence": extra,
            }
        )
    return {
        "lesson": lesson["lessonId"],
        "lessonTitle": lesson["title"],
        "transcript": lesson["file"],
        "score": round(score, 3),
        "segment": seg["text"],
        "blanks": blanks,
        "filled": sum(1 for b in blanks if b),
        "total": len(blanks),
    }


def main():
    sections = json.loads(QUESTIONS.read_text(encoding="utf8"))
    lessons = load_lessons()
    idf, _ = build_idf(lessons)
    out = []
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for section in sections:
        if only and only.lower() not in section["title"].lower():
            continue
        for q in section["questions"]:
            res = extract(q, lessons, idf)
            res.update({"section": section["title"], "module": section["module"], "question": q})
            out.append(res)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf8")
    total = sum(r["total"] for r in out)
    filled = sum(r["filled"] for r in out)
    print(f"questions: {len(out)} blanks: {total} filled: {filled} ({filled / max(1,total):.0%})")


if __name__ == "__main__":
    main()
