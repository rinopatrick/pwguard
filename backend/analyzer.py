"""Password strength analysis engine with entropy, patterns, HIBP breach check, policy rules, forbidden words, zxcvbn scoring, multi-layout keyboard detection, mutation analysis, and Indonesian breach database."""

import hashlib
import math
import os
import re
import time
import urllib.request
from dataclasses import dataclass, field
from typing import Optional

from zxcvbn_lite import zxcvbn_score_password, _is_keyboard_walk, _is_sequence, _is_repeat, _is_date

# ── HIBP Cache ───────────────────────────────────────────────────────────

_hibp_cache: dict[str, tuple[float, list[tuple[str, int]]]] = {}  # prefix -> (timestamp, [(suffix, count)])
_HIBP_CACHE_TTL = 300  # 5 minutes

_hibp_rate_limit: dict[str, list[float]] = {}  # ip -> [timestamps]
_HIBP_RATE_LIMIT = 10  # calls per minute
_HIBP_RATE_WINDOW = 60  # 1 minute


def _check_hibp_rate_limit(ip: str) -> bool:
    now = time.time()
    if ip not in _hibp_rate_limit:
        _hibp_rate_limit[ip] = []
    _hibp_rate_limit[ip] = [t for t in _hibp_rate_limit[ip] if now - t < _HIBP_RATE_WINDOW]
    if len(_hibp_rate_limit[ip]) >= _HIBP_RATE_LIMIT:
        return False
    _hibp_rate_limit[ip].append(now)
    return True


def _fetch_hibp_prefix(prefix: str) -> list[tuple[str, int]]:
    """Fetch all suffixes for a given SHA1 prefix from HIBP API."""
    url = f"https://api.pwnedpasswords.com/range/{prefix}"
    req = urllib.request.Request(url, headers={"Add-Padding": "true", "User-Agent": "PasswordVisualizer/1.0"})
    resp = urllib.request.urlopen(req, timeout=3)
    results = []
    for line in resp.read().decode("utf-8").splitlines():
        parts = line.strip().split(":")
        if len(parts) == 2:
            hash_suffix, count = parts[0].strip(), parts[1].strip()
            if count:
                results.append((hash_suffix, int(count)))
    return results


# ── Keyboard Sequences (QWERTY, Dvorak, Colemak) ────────────────────────

KEYBOARD_SEQUENCES = [
    "qwertyuiop", "asdfghjkl", "zxcvbnm",
    "qwerty", "asdfgh", "zxcvbn", "qazwsx", "edcrfv",
    "1234567890", "0987654321",
    "abcdefghij", "jihgfedcba",
]

DVORAK_SEQUENCES = [
    "'pyfgcrl", "aoeuidhtns", ";qjkxbmwvz",
    "'pyfgc", "aoeuidh", ";qjkxb",
    "apyfgcrl", "aoeuidhtn",
]

COLEMAK_SEQUENCES = [
    "qwfpgjluy", "arstdhneio", "zxcvbkm",
    "qwfpgj", "arstdh", "zxcvbk",
]

ALL_KEYBOARD_SEQUENCES = KEYBOARD_SEQUENCES + DVORAK_SEQUENCES + COLEMAK_SEQUENCES

# ── Common Passwords ─────────────────────────────────────────────────────

COMMON_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "master",
    "dragon", "111111", "baseball", "iloveyou", "trustno1", "sunshine",
    "princess", "football", "shadow", "superman", "michael", "letmein",
    "password1", "1234567", "12345", "123456789", "1234", "1234567890",
    "000000", "access", "hello", "charlie", "donald", "admin", "welcome",
    "login", "passw0rd", "passwd", "test", "guest",
    "qwerty123", "1q2w3e4r", "1qaz2wsx", "asdfghjkl", "zxcvbnm",
    "password123", "P@ssw0rd",
}

LEET_MAP = {"4": "a", "@": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", "$": "s", "7": "t", "+": "t"}

# ── Indonesian Breach Database ───────────────────────────────────────────

_INDONESIAN_BREACHES: set[str] = set()
_indonesian_breach_file = os.path.join(os.path.dirname(__file__), "indonesian_breaches.txt")
try:
    with open(_indonesian_breach_file) as f:
        for line in f:
            w = line.strip().lower()
            if w:
                _INDONESIAN_BREACHES.add(w)
except FileNotFoundError:
    pass

# ── Strength Policies ────────────────────────────────────────────────────

POLICIES = {
    "NIST": {
        "min_length": 8, "max_length": None,
        "require_upper": False, "require_lower": False,
        "require_digit": False, "require_symbol": False,
        "check_breaches": True, "max_repeats": None,
    },
    "PCI-DSS": {
        "min_length": 12, "max_length": None,
        "require_upper": True, "require_lower": True,
        "require_digit": True, "require_symbol": True,
        "check_breaches": True, "max_repeats": None,
    },
    "Corporate": {
        "min_length": 14, "max_length": None,
        "require_upper": True, "require_lower": True,
        "require_digit": True, "require_symbol": True,
        "check_breaches": True, "max_repeats": 2,
    },
    "Basic": {
        "min_length": 8, "max_length": None,
        "require_upper": False, "require_lower": False,
        "require_digit": False, "require_symbol": False,
        "check_breaches": False, "max_repeats": None,
    },
}


@dataclass
class Pattern:
    name: str
    description: str
    penalty: int


@dataclass
class AnalysisResult:
    password_length: int
    charset_size: int
    entropy: float
    crack_time_seconds: float
    crack_time_display: str
    strength_percent: int
    strength_label: str
    patterns: list[Pattern] = field(default_factory=list)
    charset_breakdown: dict = field(default_factory=dict)
    breach_count: int = 0
    breach_checked: bool = False
    policy_compliant: bool = True
    policy_violations: list[str] = field(default_factory=list)
    zxcvbn_score: int = 0
    zxcvbn_feedback: list[str] = field(default_factory=list)
    hibp_cached: bool = False
    mutations: list[Pattern] = field(default_factory=list)
    indonesian_breach: bool = False


# ── HIBP Check (with caching + rate limit + offline fallback) ─────────────

def check_hibp_breach(password: str, client_ip: str = "default") -> tuple[int, bool, bool]:
    """Check password against HIBP API with caching and rate limiting.
    Returns (breach_count, breach_checked, from_cache).
    -1 means API unavailable (offline fallback).
    """
    # Rate limit check
    if not _check_hibp_rate_limit(client_ip):
        return -1, False, False  # rate limited

    try:
        sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = sha1[:5], sha1[5:]

        # Check cache first
        now = time.time()
        if prefix in _hibp_cache:
            cached_time, cached_results = _hibp_cache[prefix]
            if now - cached_time < _HIBP_CACHE_TTL:
                for hash_suffix, count in cached_results:
                    if hash_suffix == suffix:
                        return count, True, True
                return 0, True, True  # prefix cached, suffix not found

        # Fetch from API
        results = _fetch_hibp_prefix(prefix)
        _hibp_cache[prefix] = (now, results)

        for hash_suffix, count in results:
            if hash_suffix == suffix:
                return count, True, False
        return 0, True, False

    except Exception:
        # Offline fallback: don't block analysis
        return -1, False, False


def get_breach_penalty(breach_count: int) -> int:
    """Log-scaled breach penalty based on count."""
    if breach_count <= 0:
        return 0
    if breach_count <= 10:
        return 10
    if breach_count <= 1000:
        return 20
    if breach_count <= 100000:
        return 30
    return 40


# ── Charset Detection ────────────────────────────────────────────────────

def detect_charset(password: str) -> tuple[int, dict]:
    has_lower = bool(re.search(r"[a-z]", password))
    has_upper = bool(re.search(r"[A-Z]", password))
    has_digit = bool(re.search(r"[0-9]", password))
    has_symbol = bool(re.search(r"[^a-zA-Z0-9]", password))

    size = 0
    breakdown = {}
    if has_lower:
        size += 26
        breakdown["lowercase"] = 26
    if has_upper:
        size += 26
        breakdown["uppercase"] = 26
    if has_digit:
        size += 10
        breakdown["digits"] = 10
    if has_symbol:
        size += 33
        breakdown["symbols"] = 33
    return max(size, 1), breakdown


def calculate_entropy(password: str, charset_size: int) -> float:
    if not password:
        return 0.0
    return len(password) * math.log2(charset_size) if charset_size > 1 else 0.0


def format_crack_time(seconds: float) -> str:
    if seconds < 0.001:
        return "instant"
    if seconds < 1:
        return "less than a second"
    if seconds < 60:
        return f"{int(seconds)} seconds"
    if seconds < 3600:
        mins = int(seconds / 60)
        return f"{mins} minute{'s' if mins != 1 else ''}"
    if seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''}"
    if seconds < 31536000:
        days = int(seconds / 86400)
        return f"{days} day{'s' if days != 1 else ''}"
    if seconds < 31536000 * 100:
        years = int(seconds / 31536000)
        return f"{years} year{'s' if years != 1 else ''}"
    if seconds < 31536000 * 1000000:
        centuries = int(seconds / (31536000 * 100))
        return f"{centuries} centur{'ies' if centuries != 1 else 'y'}"
    return "centuries+"


# ── Mutation Detection ───────────────────────────────────────────────────

def detect_mutations(password: str) -> list[Pattern]:
    """Detect common password mutations based on known weak passwords."""
    patterns = []
    lower = password.lower()

    # Build candidate set
    candidates = COMMON_PASSWORDS | _INDONESIAN_BREACHES

    # 1. Append number: password1, password123
    stripped = re.sub(r'\d+$', '', lower)
    if stripped != lower and stripped in candidates:
        patterns.append(Pattern("mutation", f"Common mutation of '{stripped}' detected (number appended)", 25))

    # 2. Capitalize first: Password, Qwerty
    if lower[0:1].isalpha() and password[0].isupper() and password[1:] == password[1:].lower():
        if lower in candidates:
            patterns.append(Pattern("mutation", f"Common mutation of '{lower}' detected (first letter capitalized)", 20))

    # 3. Leet speak: P@ssw0rd -> password, 1 -> i, 0 -> o
    decoded = lower
    for leet, orig in LEET_MAP.items():
        decoded = decoded.replace(leet, orig)
    if decoded != lower and decoded in candidates:
        patterns.append(Pattern("mutation", f"Common mutation of '{decoded}' detected (leetspeak)", 20))

    # 4. Reverse: drowssap -> password
    reversed_pw = lower[::-1]
    if reversed_pw in candidates:
        patterns.append(Pattern("mutation", f"Common mutation of '{reversed_pw}' detected (reversed)", 25))

    # 5. Double: passwordpassword
    half = len(lower) // 2
    if len(lower) >= 6 and lower[:half] == lower[half:2*half] and lower[:half] in candidates:
        patterns.append(Pattern("mutation", f"Common mutation of '{lower[:half]}' detected (doubled)", 25))

    # 6. Suffix mutation: password!, password@, password#
    if re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?/\\]+$', lower):
        base = re.sub(r'[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?/\\]+$', '', lower)
        if base in candidates:
            patterns.append(Pattern("mutation", f"Common mutation of '{base}' detected (symbol suffix)", 20))

    # 7. Prefix mutation: !password, 123password
    if re.search(r'^[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?/\\]+', lower):
        base = re.sub(r'^[!@#$%^&*()_+\-=\[\]{}|;:\'",.<>?/\\]+', '', lower)
        if base in candidates:
            patterns.append(Pattern("mutation", f"Common mutation of '{base}' detected (symbol prefix)", 20))

    if re.search(r'^\d+', lower):
        base = re.sub(r'^\d+', '', lower)
        if base in candidates:
            patterns.append(Pattern("mutation", f"Common mutation of '{base}' detected (number prefix)", 20))

    return patterns


# ── Pattern Detection ────────────────────────────────────────────────────
# NOTE: Keyboard walks, sequences, repeats, dates, and leetspeak are now
# handled by zxcvbn_lite.py to avoid duplicate logic. This function handles
# patterns unique to the analyzer (common passwords, Indonesian breaches,
# forbidden words, charset-only patterns).

ZXCVBN_PENALTY_MAP = {
    "dictionary": 20,
    "keyboard": 15,
    "sequence": 10,
    "repeat": 10,
    "date": 8,
    "short": 5,
}

ZXCVBN_DESC_MAP = {
    "dictionary": "Contains dictionary word",
    "keyboard": "Keyboard walk pattern detected",
    "sequence": "Sequential characters (abc, 123, etc.)",
    "repeat": "Repeating pattern detected",
    "date": "Date pattern detected",
    "short": "Password is too short",
}


def detect_patterns(password: str, forbidden_words: Optional[list[str]] = None) -> list[Pattern]:
    """Detect patterns unique to analyzer.py. Keyboard/sequence/repeat/date/leetspeak
    are handled by zxcvbn_lite and merged in analyze()."""
    patterns = []
    lower = password.lower()

    if lower in COMMON_PASSWORDS:
        patterns.append(Pattern("common_password", "This is a commonly used password", 30))

    # Indonesian breach check
    if lower in _INDONESIAN_BREACHES:
        patterns.append(Pattern("indonesian_breach", "Found in Indonesian breach database", 35))

    if len(set(password)) == 1 and len(password) > 1:
        patterns.append(Pattern("all_same", "All characters are the same", 35))

    if password.isdigit():
        patterns.append(Pattern("digits_only", "Contains only digits", 15))

    if password.isalpha() and password.islower():
        patterns.append(Pattern("lowercase_only", "Contains only lowercase letters", 10))

    # Forbidden words
    if forbidden_words:
        for word in forbidden_words:
            if word.lower() in lower and len(word) >= 2:
                patterns.append(Pattern("forbidden_word", f"Contains forbidden word: '{word}'", 25))
                break

    return patterns


# ── Policy Check ─────────────────────────────────────────────────────────

def check_policy(password: str, policy_name: str, breach_count: int) -> tuple[bool, list[str]]:
    if policy_name not in POLICIES:
        return True, []
    policy = POLICIES[policy_name]
    violations = []

    if len(password) < policy["min_length"]:
        violations.append(f"Minimum length is {policy['min_length']} characters (got {len(password)})")

    if policy["max_length"] and len(password) > policy["max_length"]:
        violations.append(f"Maximum length is {policy['max_length']} characters (got {len(password)})")

    if policy["require_upper"] and not re.search(r"[A-Z]", password):
        violations.append("Must contain at least one uppercase letter")

    if policy["require_lower"] and not re.search(r"[a-z]", password):
        violations.append("Must contain at least one lowercase letter")

    if policy["require_digit"] and not re.search(r"[0-9]", password):
        violations.append("Must contain at least one digit")

    if policy["require_symbol"] and not re.search(r"[^a-zA-Z0-9]", password):
        violations.append("Must contain at least one special character")

    if policy["check_breaches"] and breach_count > 0:
        violations.append(f"Password found in {breach_count:,} data breaches")

    if policy["max_repeats"]:
        for i in range(len(password) - policy["max_repeats"]):
            if len(set(password[i:i + policy["max_repeats"] + 1])) == 1:
                violations.append(f"No more than {policy['max_repeats']} repeated characters allowed")
                break

    return len(violations) == 0, violations


# ── Main Analysis ────────────────────────────────────────────────────────

def analyze(password: str, policy: Optional[str] = None, forbidden_words: Optional[list[str]] = None,
            client_ip: str = "default") -> AnalysisResult:
    if not password:
        return AnalysisResult(
            password_length=0, charset_size=0, entropy=0.0,
            crack_time_seconds=0, crack_time_display="instant",
            strength_percent=0, strength_label="Empty",
        )

    charset_size, charset_breakdown = detect_charset(password)
    entropy = calculate_entropy(password, charset_size)
    patterns = detect_patterns(password, forbidden_words)

    # Mutation detection
    mutations = detect_mutations(password)
    for m in mutations:
        patterns.append(m)

    # Indonesian breach check
    indonesian_breach = password.lower() in _INDONESIAN_BREACHES

    # Apply pattern penalties
    penalty = sum(p.penalty for p in patterns)
    effective_entropy = max(entropy - penalty, 0)

    # HIBP check (with caching, rate limit, offline fallback)
    breach_count, breach_checked, hibp_cached = check_hibp_breach(password, client_ip)
    if breach_checked and breach_count > 0:
        breach_penalty = get_breach_penalty(breach_count)
        patterns.append(Pattern("breached_password",
                                f"Found {breach_count:,} times in data breaches",
                                breach_penalty))
        penalty += breach_penalty
        effective_entropy = max(entropy - penalty, 0)
    elif not breach_checked and breach_count == -1:
        # Offline fallback - add informational pattern
        patterns.append(Pattern("hibp_unavailable", "HIBP breach check unavailable (offline)", 0))

    # Crack time
    hashes_per_second = 10_000_000_000
    combinations = 2 ** effective_entropy if effective_entropy > 0 else 1
    crack_time_seconds = combinations / hashes_per_second / 2
    crack_time_display = format_crack_time(crack_time_seconds)

    # Strength percent
    strength_percent = min(int((effective_entropy / 128) * 100), 100)

    # Strength label
    if strength_percent < 20:
        strength_label = "Very Weak"
    elif strength_percent < 40:
        strength_label = "Weak"
    elif strength_percent < 60:
        strength_label = "Fair"
    elif strength_percent < 80:
        strength_label = "Strong"
    else:
        strength_label = "Very Strong"

    # Policy compliance
    policy_compliant, policy_violations = True, []
    if policy:
        effective_breach = breach_count if breach_checked and breach_count > 0 else 0
        policy_compliant, policy_violations = check_policy(password, policy, effective_breach)

    # zxcvbn-lite scoring — merge match patterns into our pattern list
    zx_result = zxcvbn_score_password(password)
    for match in zx_result.get("matches", []):
        match_type = match.get("type", "")
        if match_type in ZXCVBN_PENALTY_MAP:
            patterns.append(Pattern(
                name=f"zxcvbn_{match_type}",
                description=match.get("detail", ZXCVBN_DESC_MAP.get(match_type, "")),
                penalty=ZXCVBN_PENALTY_MAP[match_type],
            ))

    # Recalculate effective entropy with zxcvbn patterns included
    total_penalty = sum(p.penalty for p in patterns)
    effective_entropy = max(entropy - total_penalty, 0)
    strength_percent = min(int((effective_entropy / 128) * 100), 100)
    if strength_percent < 20:
        strength_label = "Very Weak"
    elif strength_percent < 40:
        strength_label = "Weak"
    elif strength_percent < 60:
        strength_label = "Fair"
    elif strength_percent < 80:
        strength_label = "Strong"
    else:
        strength_label = "Very Strong"

    return AnalysisResult(
        password_length=len(password),
        charset_size=charset_size,
        entropy=round(entropy, 2),
        crack_time_seconds=crack_time_seconds,
        crack_time_display=crack_time_display,
        strength_percent=strength_percent,
        strength_label=strength_label,
        patterns=patterns,
        charset_breakdown=charset_breakdown,
        breach_count=max(breach_count, 0),
        breach_checked=breach_checked,
        policy_compliant=policy_compliant,
        policy_violations=policy_violations,
        zxcvbn_score=zx_result["score"],
        zxcvbn_feedback=zx_result["feedback"],
        hibp_cached=hibp_cached,
        mutations=mutations,
        indonesian_breach=indonesian_breach,
    )
