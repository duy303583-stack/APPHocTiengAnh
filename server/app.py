"""Máy chủ EngMate (Flask).

- Phục vụ giao diện web (HTML/CSS/JS ở thư mục gốc dự án).
- /api/chat, /api/assist: gia sư AI và các công cụ AI qua Claude API; API key nằm ở máy chủ (biến môi trường ANTHROPIC_API_KEY).
- /api/progress/<user_id>: lưu/đồng bộ tiến độ học vào SQLite.

Chạy:  pip install -r server/requirements.txt
       set ANTHROPIC_API_KEY=sk-ant-...   (PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-...")
       python server/app.py
"""
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

import anthropic
from flask import Flask, Response, abort, g, jsonify, request, send_from_directory, stream_with_context

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(__file__).resolve().parent / "engmate.db"
MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

app = Flask(__name__, static_folder=None)
client = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None

LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
# Prompt dùng chung với js/ai.js.
PROMPTS = json.loads((ROOT / "js" / "prompts.json").read_text(encoding="utf-8"))


def fill(template, values):
    return re.sub(r"\{(\w+)\}", lambda m: str(values.get(m.group(1), m.group(0))), template)


def clean_words(words):
    if not isinstance(words, list):
        return []
    return [str(w)[:40] for w in words if isinstance(w, str) and w.strip()][:8]


def tutor_system_prompt(level, age_group, scenario_id, name, words):
    return fill(PROMPTS["tutor"], {
        "name": name or "the learner",
        "level": level,
        "age_style": PROMPTS["age"].get(age_group, PROMPTS["age"]["adult"]),
        "scenario": PROMPTS["scenarios"].get(scenario_id, PROMPTS["scenarios"]["free"]),
        "words_line": fill(PROMPTS["words_line"], {"words": ", ".join(words)}) if words else "",
    })


# ---------------- Database ----------------
def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.execute("CREATE TABLE IF NOT EXISTS progress (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn:
        conn.close()


USER_ID = re.compile(r"^[a-z0-9-]{8,64}$")


@app.get("/api/progress/<user_id>")
def get_progress(user_id):
    if not USER_ID.match(user_id):
        abort(400)
    row = db().execute("SELECT data, updated_at FROM progress WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return jsonify({"data": None})
    return jsonify({"data": json.loads(row[0]), "updatedAt": row[1]})


@app.put("/api/progress/<user_id>")
def put_progress(user_id):
    if not USER_ID.match(user_id) or request.content_length and request.content_length > 2_000_000:
        abort(400)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400)
    data.get("settings", {}).pop("apiKey", None)  # không bao giờ lưu key của người dùng
    updated = int(data.get("updatedAt") or time.time() * 1000)
    db().execute(
        "INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
        (user_id, json.dumps(data, ensure_ascii=False), updated),
    )
    db().commit()
    return jsonify({"ok": True})


@app.get("/api/stats/<user_id>")
def get_stats(user_id):
    """Tóm tắt XP/chuỗi ngày/cấp độ, dùng cho app Android hoặc widget."""
    if not USER_ID.match(user_id):
        abort(400)
    row = db().execute("SELECT data FROM progress WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        abort(404)
    data = json.loads(row[0])
    return jsonify({
        "name": data.get("profile", {}).get("name"),
        "level": data.get("profile", {}).get("level"),
        "xp": data.get("xp", 0),
        "streak": data.get("streak", 0),
        "lastDay": data.get("lastDay"),
        "lessonsCompleted": len(data.get("completed", {})),
        "badges": len(data.get("badges", [])),
    })


# ---------------- AI ----------------
@app.get("/api/health")
def health():
    return jsonify({"ok": True, "ai": client is not None, "model": MODEL})


def valid_history(history):
    if not isinstance(history, list) or not 1 <= len(history) <= 120:
        return False
    for i, m in enumerate(history):
        if not isinstance(m, dict) or m.get("role") != ("user" if i % 2 == 0 else "assistant"):
            return False
        if m["role"] == "user" and not (isinstance(m.get("content"), str) and 0 < len(m["content"]) <= 2000):
            return False
    return history[-1]["role"] == "user"


def sse(obj):
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def friendly_error(err):
    if isinstance(err, anthropic.AuthenticationError):
        return "API key trên máy chủ không hợp lệ."
    if isinstance(err, anthropic.RateLimitError):
        return "Đang gửi quá nhiều yêu cầu, hãy đợi một chút rồi thử lại."
    if isinstance(err, anthropic.APIStatusError) and err.status_code >= 500:
        return "Máy chủ AI đang bận, hãy thử lại sau."
    if isinstance(err, anthropic.APIConnectionError):
        return "Máy chủ không kết nối được tới Claude API."
    return "Có lỗi khi kết nối gia sư AI."


def open_stream(params):
    """Ưu tiên server-side fallback; nếu tài khoản chưa có beta này thì gọi bình thường."""
    try:
        s = client.beta.messages.stream(**params, betas=[FALLBACK_BETA], fallbacks="default")
        return s.__enter__(), s
    except anthropic.BadRequestError as err:
        if "fallback" not in str(err).lower():
            raise
    s = client.messages.stream(**params)
    return s.__enter__(), s


@app.post("/api/chat")
def chat():
    if client is None:
        return jsonify({"error": "Máy chủ chưa cấu hình ANTHROPIC_API_KEY."}), 503
    body = request.get_json(silent=True) or {}
    history = body.get("history")
    level = body.get("level") if body.get("level") in LEVELS else "A1"
    if not valid_history(history):
        return jsonify({"error": "Dữ liệu hội thoại không hợp lệ."}), 400
    params = {
        "model": MODEL,
        "max_tokens": 2048,
        "system": tutor_system_prompt(level, body.get("ageGroup"), body.get("scenario"), str(body.get("name", ""))[:40],
                                      clean_words(body.get("words"))),
        "messages": history,
        "output_config": {"effort": "low"},
    }

    def generate():
        try:
            stream, manager = open_stream(params)
            try:
                for text in stream.text_stream:
                    yield sse({"text": text})
                msg = stream.get_final_message()
            finally:
                manager.__exit__(None, None, None)
            content = [block.model_dump(mode="json", exclude_none=True) for block in msg.content]
            yield sse({"done": True, "stop_reason": msg.stop_reason, "content": content})
        except anthropic.APIError as err:
            app.logger.warning("chat error: %s", err)
            yield sse({"error": friendly_error(err)})

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/assist")
def assist():
    """Công cụ AI trả JSON theo schema: write | translate | story | quiz."""
    if client is None:
        return jsonify({"error": "Máy chủ chưa cấu hình ANTHROPIC_API_KEY."}), 503
    body = request.get_json(silent=True) or {}
    task = PROMPTS["tasks"].get(body.get("task"))
    if task is None:
        return jsonify({"error": "Tác vụ không hợp lệ."}), 400
    values = {
        "level": body.get("level") if body.get("level") in LEVELS else "A1",
        "input": str(body.get("input", ""))[:4000],
        "extra": str(body.get("extra", ""))[:1000],
        "words": ", ".join(clean_words(body.get("words"))),
    }
    if not values["input"].strip():
        return jsonify({"error": "Nội dung trống."}), 400
    try:
        msg = client.messages.create(
            model=MODEL,
            max_tokens=task["max_tokens"],
            system=task["system"],
            messages=[{"role": "user", "content": fill(task["user"], values)}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": task["schema"]}},
        )
    except anthropic.APIError as err:
        app.logger.warning("assist error: %s", err)
        return jsonify({"error": friendly_error(err)}), 502
    if msg.stop_reason == "refusal":
        return jsonify({"error": "AI không thể xử lý yêu cầu này. Hãy thử nội dung khác."}), 422
    if msg.stop_reason == "max_tokens":
        return jsonify({"error": "Nội dung quá dài, hãy rút ngắn rồi thử lại."}), 422
    text = "".join(b.text for b in msg.content if b.type == "text")
    return jsonify({"result": json.loads(text)})


# ---------------- Giao diện web ----------------
@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:path>")
def static_files(path):
    if path.startswith(("server/", "android/")) or path.startswith("."):
        abort(404)
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    # Console Windows mặc định cp1252, không in được tiếng Việt/emoji.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if client is None:
        print("⚠️  Chưa đặt ANTHROPIC_API_KEY: bài học vẫn chạy, nhưng gia sư AI trên máy chủ sẽ tắt.")
    port = int(os.environ.get("PORT", 5000))
    print(f"🦉 EngMate đang chạy tại http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
