"""Simplified zxcvbn-inspired password scoring engine.

Provides dictionary-based matching, reverse dictionary, l33t speak decoding,
date patterns, repeat patterns, sequence patterns, and spatial/keyboard patterns.
Returns a score 0-4 and actionable feedback.
"""

import re
from typing import Any

# ── Common words (subset for dictionary matching) ────────────────────────
COMMON_WORDS = {
    "password", "dragon", "master", "monkey", "shadow", "sunshine", "princess",
    "football", "superman", "michael", "letmein", "hello", "charlie", "donald",
    "admin", "welcome", "login", "test", "guest", "love", "secret", "summer",
    "winter", "spring", "autumn", "coffee", "cookie", "killer", "hunter",
    "matrix", "phoenix", "orange", "purple", "hammer", "spark", "thunder",
    "flower", "garden", "rocket", "silver", "golden", "diamond", "crystal",
    "falcon", "wizard", "knight", "castle", "tiger", "panther", "eagle",
    "angel", "demon", "frost", "blaze", "storm", "raven", "wolf", "fox",
    "bear", "hawk", "moon", "star", "fire", "rain", "snow", "wind",
    "earth", "ocean", "river", "mountain", "forest", "island", "desert",
    "computer", "internet", "system", "server", "network", "security",
    "keyboard", "monitor", "mouse", "printer", "program", "database",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "indonesia", "jakarta", "bandung", "surabaya", "medan", "bali",
    "merdeka", "garuda", "nusantara", "batik", "rendang", "sate",
    "sayang", "cinta", "hati", "jiwa", "hidup", "mati", "dunia",
}

# ── Keyboard walks ───────────────────────────────────────────────────────
KEYBOARD_ROWS = [
    "qwertyuiop", "asdfghjkl", "zxcvbnm",
    "1234567890",
    "qwfpgjluy",  # Colemak top row
    "arstdhneio",  # Colemak home row
    "'pyfgcrl",   # Dvorak top row
    "aoeuidhtns",  # Dvorak home row
]


def _is_keyboard_walk(password: str, min_len: int = 4) -> bool:
    """Check if password is a keyboard walk (adjacent keys on any row)."""
    lower = password.lower()
    for row in KEYBOARD_ROWS:
        if len(lower) >= min_len:
            for i in range(len(row) - len(lower) + 1):
                if row[i:i + len(lower)] == lower or row[i:i + len(lower)] == lower[::-1]:
                    return True
    return False


def _is_sequence(password: str, min_len: int = 4) -> bool:
    """Check if password is a sequential pattern (abc, 123, zyx, etc.)."""
    if len(password) < min_len:
        return False
    lower = password.lower()

    # Check ascending/descending char sequences
    ords = [ord(c) for c in lower]
    if len(ords) >= min_len:
        ascending = all(ords[i + 1] == ords[i] + 1 for i in range(len(ords) - 1))
        descending = all(ords[i + 1] == ords[i] - 1 for i in range(len(ords) - 1))
        if ascending or descending:
            return True
    return False


def _is_repeat(password: str, min_len: int = 4) -> bool:
    """Check if password is a repeating pattern (aaaa, abcabc, abab)."""
    if len(password) < min_len:
        return False

    # All same char
    if len(set(password)) == 1:
        return True

    # Repeating substring
    for pat_len in range(1, len(password) // 2 + 1):
        pattern = password[:pat_len]
        if pattern * (len(password) // pat_len) == password[:pat_len * (len(password) // pat_len)]:
            if len(password) // pat_len >= 2:
                return True
    return False


def _is_date(password: str) -> bool:
    """Check if password looks like a date pattern."""
    # YYYY
    if re.match(r"^(19|20)\d{2}$", password):
        return True
    # DD/MM/YYYY or MM/DD/YYYY
    if re.match(r"^\d{1,2}[/\-.]\d{1,2}[/\-.](19|20)?\d{2}$", password):
        return True
    # YYYYMMDD
    if re.match(r"^(19|20)\d{6}$", password):
        return True
    # DDMMYYYY
    if re.match(r"^\d{2}(0[1-9]|1[0-2])(19|20)\d{2}$", password):
        return True
    return False


def _leet_decode(password: str) -> str:
    """Decode l33t speak substitutions."""
    leet_map = {
        "4": "a", "@": "a", "8": "b", "(": "c", "{": "c",
        "3": "e", "6": "g", "#": "h", "!": "i", "1": "i", "|": "l",
        "0": "o", "5": "s", "$": "s", "7": "t", "+": "t",
        "\\/": "v", "2": "z",
    }
    result = password.lower()
    for leet, normal in leet_map.items():
        result = result.replace(leet, normal)
    return result


def _check_dictionary(password: str) -> tuple[bool, str]:
    """Check if password (or its leet-decoded form) contains a dictionary word."""
    lower = password.lower()

    # Direct match
    if lower in COMMON_WORDS:
        return True, lower

    # Leet-decoded match
    decoded = _leet_decode(lower)
    if decoded in COMMON_WORDS and decoded != lower:
        return True, decoded

    # Check if password contains a common word
    for word in COMMON_WORDS:
        if len(word) >= 4 and word in lower:
            return True, word

    # Reverse
    reversed_pw = lower[::-1]
    for word in COMMON_WORDS:
        if len(word) >= 4 and word in reversed_pw:
            return True, f"reversed '{word}'"

    return False, ""


# ── Main Scoring Function ────────────────────────────────────────────────

def zxcvbn_score_password(password: str) -> dict[str, Any]:
    """Score a password using zxcvbn-inspired heuristics.

    Returns:
        {
            "score": 0-4,
            "label": str,
            "feedback": [str, ...],
            "crack_time_display": str,
            "matches": [{"type": str, "detail": str, "entropy": float}, ...]
        }
    """
    if not password:
        return {"score": 0, "label": "Empty", "feedback": ["Password is empty"], "matches": []}

    matches: list[dict[str, Any]] = []
    feedback: list[str] = []

    # ── Matcher 1: Dictionary ────────────────────────────────────────────
    found, word = _check_dictionary(password)
    if found:
        matches.append({"type": "dictionary", "detail": f"Contains dictionary word: '{word}'", "entropy": 10})
        feedback.append(f"Avoid using dictionary words like '{word}'")

    # ── Matcher 2: Keyboard walk ─────────────────────────────────────────
    if _is_keyboard_walk(password):
        matches.append({"type": "keyboard", "detail": "Keyboard walk pattern", "entropy": 8})
        feedback.append("Avoid keyboard walk patterns (qwerty, asdf, etc.)")

    # ── Matcher 3: Sequence ──────────────────────────────────────────────
    if _is_sequence(password):
        matches.append({"type": "sequence", "detail": "Sequential characters", "entropy": 8})
        feedback.append("Avoid sequential patterns (abc, 123, etc.)")

    # ── Matcher 4: Repeat ────────────────────────────────────────────────
    if _is_repeat(password):
        matches.append({"type": "repeat", "detail": "Repeating pattern", "entropy": 6})
        feedback.append("Avoid repeating characters or patterns")

    # ── Matcher 5: Date ──────────────────────────────────────────────────
    if _is_date(password):
        matches.append({"type": "date", "detail": "Date pattern detected", "entropy": 12})
        feedback.append("Avoid using dates — they're easy to guess")

    # ── Matcher 6: Short length ──────────────────────────────────────────
    if len(password) < 8:
        matches.append({"type": "short", "detail": f"Only {len(password)} characters", "entropy": len(password) * 2})
        feedback.append(f"Use at least 8 characters (currently {len(password)})")

    # ── Calculate effective entropy ──────────────────────────────────────
    if matches:
        # Use worst-case (lowest entropy) match
        min_entropy = min(m["entropy"] for m in matches)
        # Penalize more for multiple match types
        penalty = len(matches) * 3
        effective_entropy = max(min_entropy - penalty, 0)
    else:
        # No patterns found — calculate from charset + length
        charset_size = 0
        if re.search(r"[a-z]", password): charset_size += 26
        if re.search(r"[A-Z]", password): charset_size += 26
        if re.search(r"[0-9]", password): charset_size += 10
        if re.search(r"[^a-zA-Z0-9]", password): charset_size += 33
        if charset_size == 0: charset_size = 26

        effective_entropy = len(password) * (3.0 if charset_size > 60 else 2.5)
        # Cap at 60 for non-dictionary passwords (we're being conservative)
        effective_entropy = min(effective_entropy, 60)

    # ── Score 0-4 ────────────────────────────────────────────────────────
    if effective_entropy < 10:
        score = 0
        label = "Too Guessable"
    elif effective_entropy < 20:
        score = 1
        label = "Very Guessable"
    elif effective_entropy < 35:
        score = 2
        label = "Somewhat Guessable"
    elif effective_entropy < 50:
        score = 3
        label = "Safe"
    else:
        score = 4
        label = "Very Safe"

    # Crack time estimate from zxcvbn score
    crack_seconds = 10 ** (effective_entropy * 0.3)  # rough approximation
    if crack_seconds < 1:
        crack_display = "instant"
    elif crack_seconds < 60:
        crack_display = f"{int(crack_seconds)} seconds"
    elif crack_seconds < 3600:
        crack_display = f"{int(crack_seconds / 60)} minutes"
    elif crack_seconds < 86400:
        crack_display = f"{int(crack_seconds / 3600)} hours"
    elif crack_seconds < 31536000:
        crack_display = f"{int(crack_seconds / 86400)} days"
    elif crack_seconds < 31536000 * 100:
        crack_display = f"{int(crack_seconds / 31536000)} years"
    else:
        crack_display = "centuries+"

    # Add general feedback if score is low
    if score <= 1 and not feedback:
        feedback.append("This password is too easily guessable. Try a longer passphrase.")
    if score >= 3 and not feedback:
        feedback.append("Good password! Consider making it even longer for extra safety.")

    return {
        "score": score,
        "label": label,
        "feedback": feedback[:5],  # Max 5 feedback items
        "crack_time_display": crack_display,
        "matches": matches,
    }
