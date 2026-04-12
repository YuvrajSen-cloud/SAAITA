import re
import json
import base64
import sqlite3
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from database import init_db, get_db

# --- Read config from environment ---
import os
from dotenv import load_dotenv
load_dotenv()

FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175"
).split(",")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

app = Flask(__name__)

CORS(app, supports_credentials=True, resources={
    r"/api/*": {"origins": ALLOWED_ORIGINS}
})

# Rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://"
)

# In-memory AI chat sessions: session_id -> { gemini_chat, chat_group_id }
ai_sessions = {}

# --- Constants ---
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
PASSWORD_MIN_LENGTH = 8
SESSION_DURATION_DAYS = 7


# =========================================================
# GEMINI AI SETUP
# =========================================================

def get_gemini_model(user_profile: str = ""):
    """Build and return a Gemini GenerativeModel with SAAITA system prompt."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)

        prompt_path = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
        with open(prompt_path, "r", encoding="utf-8") as f:
            base_instruction = f.read().strip()

        full_instruction = base_instruction
        if user_profile:
            full_instruction += f"\n\nUSER PROFILE: {user_profile}"

        return genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=full_instruction
        )
    except Exception as e:
        print(f"[SAAITA] Gemini model init error: {e}")
        return None


def explain_image_with_gemini(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Describe an image using Gemini vision."""
    try:
        import google.generativeai as genai
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content([
            "Describe this image in detail so another language model can understand its contents and help the user.",
            {"mime_type": mime_type, "data": image_bytes}
        ])
        return response.text
    except Exception as e:
        return f"(Image processing failed: {e})"


def get_or_create_ai_session(session_id: str, user_id: int, onboarding_data: str = ""):
    """Get existing Gemini chat session or create a new one."""
    if session_id in ai_sessions:
        return ai_sessions[session_id]

    # Load chat history from DB
    conn = get_db()
    rows = conn.execute(
        "SELECT sender, text FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC",
        (user_id,)
    ).fetchall()
    conn.close()

    formatted_history = []
    for row in rows:
        role = "user" if row["sender"] == "user" else "model"
        formatted_history.append({"role": role, "parts": [row["text"]]})

    model = get_gemini_model(onboarding_data or "")
    if model is None:
        return None

    chat = model.start_chat(history=formatted_history)
    new_group_id = str(uuid.uuid4())

    ai_sessions[session_id] = {
        "chat": chat,
        "chat_group_id": new_group_id,
        "user_id": user_id
    }
    return ai_sessions[session_id]


# =========================================================
# AUTH HELPERS
# =========================================================

def validate_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    if not any(c.isalpha() for c in password):
        return False, "Password must contain at least one letter."
    return True, ""


def create_session(user_id: int) -> str:
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)",
        (session_id, user_id, expires_at.isoformat())
    )
    conn.commit()
    conn.close()
    return session_id


def get_session_user(session_id: str):
    conn = get_db()
    row = conn.execute("""
        SELECT u.id, u.full_name, u.email, u.created_at, u.is_onboarded, u.onboarding_data, s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ?
    """, (session_id,)).fetchone()

    if not row:
        conn.close()
        return None

    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() > expires_at:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()
        return None

    conn.close()
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "member_since": row["created_at"][:10] if row["created_at"] else "—",
        "is_onboarded": bool(row["is_onboarded"]),
        "onboarding_data": row["onboarding_data"] or ""
    }


def require_session(f):
    """Decorator to protect routes by validating session_id header."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        session_id = request.headers.get("X-Session-Id")
        if not session_id:
            return jsonify({"error": "No session provided."}), 401
        user = get_session_user(session_id)
        if not user:
            return jsonify({"error": "Session expired or invalid."}), 401
        return f(user, session_id, *args, **kwargs)
    return decorated


# =========================================================
# AUTH ROUTES
# =========================================================

@app.route("/api/auth/signup", methods=["POST"])
@limiter.limit("5 per minute")
def signup():
    data = request.json or {}
    full_name = data.get("fullName", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not full_name or not email or not password:
        return jsonify({"error": "All fields are required."}), 400
    if not validate_email(email):
        return jsonify({"error": "Invalid email address format."}), 400
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400

    pwd_hash = generate_password_hash(password)
    conn = get_db()
    try:
        c = conn.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
            (full_name, email, pwd_hash)
        )
        user_id = c.lastrowid
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "This email is already registered."}), 409
    finally:
        conn.close()

    session_id = create_session(user_id)
    return jsonify({
        "session_id": session_id,
        "user": {"id": user_id, "full_name": full_name, "email": email, "is_onboarded": False}
    }), 201


@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400
    if not validate_email(email):
        return jsonify({"error": "Invalid email address format."}), 400

    conn = get_db()
    row = conn.execute(
        "SELECT id, full_name, password_hash, is_onboarded FROM users WHERE email = ?", (email,)
    ).fetchone()
    conn.close()

    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    session_id = create_session(row["id"])
    return jsonify({
        "session_id": session_id,
        "user": {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": email,
            "is_onboarded": bool(row["is_onboarded"])
        }
    })


@app.route("/api/auth/me", methods=["GET"])
def me():
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        return jsonify({"error": "No session provided."}), 401
    user = get_session_user(session_id)
    if not user:
        return jsonify({"error": "Session expired or invalid."}), 401
    return jsonify({"user": user})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session_id = request.headers.get("X-Session-Id")
    if session_id:
        # Remove AI session too
        ai_sessions.pop(session_id, None)
        conn = get_db()
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()
    return jsonify({"message": "Logged out successfully."})


@app.route("/api/auth/onboarding", methods=["POST"])
def complete_onboarding():
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        return jsonify({"error": "No session provided."}), 401

    user = get_session_user(session_id)
    if not user:
        return jsonify({"error": "Session expired or invalid."}), 401

    data = request.json or {}

    conn = get_db()
    conn.execute(
        "UPDATE users SET is_onboarded = 1, onboarding_data = ? WHERE id = ?",
        (json.dumps(data), user["id"])
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message": "Onboarding completed successfully.",
        "user": {**user, "is_onboarded": True}
    })


# =========================================================
# CHAT ROUTES
# =========================================================

@app.route("/api/chat/message", methods=["POST"])
@limiter.limit("60 per minute")
def chat_message():
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        return jsonify({"error": "No session provided."}), 401

    user = get_session_user(session_id)
    if not user:
        return jsonify({"error": "Session expired or invalid."}), 401

    if not GEMINI_API_KEY:
        return jsonify({"error": "AI service is not configured. Please add GEMINI_API_KEY to backend .env"}), 503

    data = request.json or {}
    prompt = data.get("prompt", "").strip()
    images = data.get("images", [])

    if not prompt and not images:
        return jsonify({"error": "Message cannot be empty."}), 400

    # Get or initialize AI session
    ai_sess = get_or_create_ai_session(session_id, user["id"], user.get("onboarding_data", ""))
    if ai_sess is None:
        return jsonify({"error": "Failed to initialize AI. Check your GEMINI_API_KEY."}), 503

    # Process images
    image_context_text = ""
    db_prompt = prompt
    if images:
        image_descriptions = []
        for idx, img in enumerate(images):
            try:
                img_bytes = base64.b64decode(img["data"])
                desc = explain_image_with_gemini(img_bytes, img.get("mime_type", "image/jpeg"))
                image_descriptions.append(f"Image {idx + 1}: {desc}")
            except Exception as e:
                image_descriptions.append(f"Image {idx + 1}: (failed to process)")

        image_context_text = "\n\n[System Note: User attached images. Descriptions:]\n" + "\n".join(image_descriptions)
        db_prompt += f" [{len(images)} image(s) attached]"

    final_prompt = prompt + image_context_text

    # Save user message to DB
    conn = get_db()
    conn.execute(
        "INSERT INTO chat_messages (user_id, sender, text, chat_group_id) VALUES (?, ?, ?, ?)",
        (user["id"], "user", db_prompt, ai_sess["chat_group_id"])
    )
    conn.commit()
    conn.close()

    try:
        response = ai_sess["chat"].send_message(final_prompt)
        ai_text = response.text

        # Save AI response to DB
        conn = get_db()
        conn.execute(
            "INSERT INTO chat_messages (user_id, sender, text, chat_group_id) VALUES (?, ?, ?, ?)",
            (user["id"], "ai", ai_text, ai_sess["chat_group_id"])
        )
        conn.commit()
        conn.close()

        return jsonify({"text": ai_text})
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)}"}), 500


@app.route("/api/chat/history", methods=["GET"])
def chat_history():
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        return jsonify({"error": "No session provided."}), 401

    user = get_session_user(session_id)
    if not user:
        return jsonify({"error": "Session expired or invalid."}), 401

    conn = get_db()
    rows = conn.execute(
        "SELECT sender, text FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC",
        (user["id"],)
    ).fetchall()
    conn.close()

    messages = [{"sender": r["sender"], "text": r["text"]} for r in rows]
    return jsonify({"messages": messages})


@app.route("/api/chat/clear", methods=["POST"])
def chat_clear():
    session_id = request.headers.get("X-Session-Id")
    if not session_id:
        return jsonify({"error": "No session provided."}), 401

    user = get_session_user(session_id)
    if not user:
        return jsonify({"error": "Session expired or invalid."}), 401

    # Create new chat group (old messages stay in DB but new session is fresh)
    new_group_id = str(uuid.uuid4())
    if session_id in ai_sessions:
        ai_sess = ai_sessions[session_id]
        ai_sess["chat_group_id"] = new_group_id
        # Reinitialize Gemini chat with empty history
        model = get_gemini_model(user.get("onboarding_data", ""))
        if model:
            ai_sess["chat"] = model.start_chat(history=[])

    return jsonify({"success": True, "chat_group_id": new_group_id})


# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many attempts. Please wait a moment and try again."}), 429


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error."}), 500


if __name__ == "__main__":
    init_db()
    if not GEMINI_API_KEY:
        print("\n⚠️  WARNING: GEMINI_API_KEY is not set in .env — AI chat will not work!\n")
    else:
        print(f"\n✅ GEMINI_API_KEY loaded — AI chat enabled\n")
    app.run(port=5000, debug=FLASK_DEBUG)
