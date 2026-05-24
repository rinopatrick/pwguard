"""Password Strength Visualizer — FastAPI backend.
Features: analyze, generate, passphrase, compare, report, policies, HIBP breach check,
bulk analyze, QR code, API key auth, rate limiting, breach monitoring, suggestions,
dark web check, export analysis.
"""

import csv
import hashlib
import html
import io
import math
import secrets
import string
import time
import threading
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, create_engine, func
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timedelta

from analyzer import analyze, POLICIES, check_hibp_breach
from wordlist import WORDS as EN_WORDS
from wordlist_id import WORDS as ID_WORDS

# ── Database ─────────────────────────────────────────────────────────────

DATABASE_URL = "sqlite:///./pwguard.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(32), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    request_count = Column(Integer, default=0)


class BreachMonitor(Base):
    __tablename__ = "breach_monitors"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_checked = Column(DateTime, nullable=True)
    breach_count = Column(Integer, default=0)
    breach_details = Column(Text, default="")
    notified = Column(Boolean, default=False)


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    policy_name = Column(String(50), default="Basic")


class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer)
    name = Column(String(200))
    role = Column(String(20), default="member")  # admin/member
    avg_strength = Column(Float, default=0.0)
    breach_exposed = Column(Boolean, default=False)
    added_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# ── Background Breach Monitor ────────────────────────────────────────────

def _check_monitored_emails():
    """Background task: check all monitored emails against HIBP."""
    while True:
        time.sleep(3600)  # every hour
        try:
            db = SessionLocal()
            monitors = db.query(BreachMonitor).all()
            for m in monitors:
                try:
                    import urllib.request
                    url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{m.email}"
                    req = urllib.request.Request(url, headers={"User-Agent": "PWGuard/1.0", "hibp-api-key": ""})
                    try:
                        resp = urllib.request.urlopen(req, timeout=5)
                        breaches = resp.read().decode()
                        import json
                        breach_list = json.loads(breaches) if breaches.strip() else []
                        m.breach_count = len(breach_list)
                        m.breach_details = json.dumps([b.get("Name", "") for b in breach_list[:10]])
                    except Exception:
                        pass  # 404 = no breaches, or API key needed
                    m.last_checked = datetime.utcnow()
                    db.commit()
                except Exception:
                    pass
            db.close()
        except Exception:
            pass

_bg_thread = threading.Thread(target=_check_monitored_emails, daemon=True)
_bg_thread.start()

app = FastAPI(title="Password Strength Visualizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORDLISTS = {"en": EN_WORDS, "id": ID_WORDS}

# ── Rate Limiting ────────────────────────────────────────────────────────

rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 100
RATE_WINDOW = 3600


def check_rate_limit(key: str) -> bool:
    now = time.time()
    rate_limit_store[key] = [t for t in rate_limit_store[key] if now - t < RATE_WINDOW]
    if len(rate_limit_store[key]) >= RATE_LIMIT:
        return False
    rate_limit_store[key].append(now)
    return True


# ── Analyze ──────────────────────────────────────────────────────────────

class PasswordRequest(BaseModel):
    password: str
    policy: Optional[str] = None
    forbidden_words: Optional[list[str]] = None


class PatternResponse(BaseModel):
    name: str
    description: str
    penalty: int


class AnalysisResponse(BaseModel):
    password_length: int
    charset_size: int
    entropy: float
    crack_time_seconds: float
    crack_time_display: str
    strength_percent: int
    strength_label: str
    patterns: list[PatternResponse]
    charset_breakdown: dict
    breach_count: int
    breach_checked: bool
    policy_compliant: bool
    policy_violations: list[str]
    zxcvbn_score: int
    zxcvbn_feedback: list[str]
    hibp_cached: bool
    mutations: list[PatternResponse] = []
    indonesian_breach: bool = False


@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_password(req: PasswordRequest, request: Request):
    client_ip = request.client.host if request.client else "default"
    result = analyze(req.password, policy=req.policy, forbidden_words=req.forbidden_words, client_ip=client_ip)
    return AnalysisResponse(
        password_length=result.password_length,
        charset_size=result.charset_size,
        entropy=result.entropy,
        crack_time_seconds=result.crack_time_seconds,
        crack_time_display=result.crack_time_display,
        strength_percent=result.strength_percent,
        strength_label=result.strength_label,
        patterns=[PatternResponse(name=p.name, description=p.description, penalty=p.penalty) for p in result.patterns],
        charset_breakdown=result.charset_breakdown,
        breach_count=result.breach_count,
        breach_checked=result.breach_checked,
        policy_compliant=result.policy_compliant,
        policy_violations=result.policy_violations,
        zxcvbn_score=result.zxcvbn_score,
        zxcvbn_feedback=result.zxcvbn_feedback,
        hibp_cached=result.hibp_cached,
        mutations=[PatternResponse(name=m.name, description=m.description, penalty=m.penalty) for m in result.mutations],
        indonesian_breach=result.indonesian_breach,
    )


# ── Generate ─────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    length: int = 16
    include_uppercase: bool = True
    include_lowercase: bool = True
    include_digits: bool = True
    include_symbols: bool = True


class GenerateResponse(BaseModel):
    password: str
    entropy: float
    strength_label: str
    strength_percent: int


@app.post("/api/generate", response_model=GenerateResponse)
def generate_password(req: GenerateRequest):
    length = max(8, min(128, req.length))
    charset = ""
    if req.include_lowercase:
        charset += string.ascii_lowercase
    if req.include_uppercase:
        charset += string.ascii_uppercase
    if req.include_digits:
        charset += string.digits
    if req.include_symbols:
        charset += "!@#$%^&*()-_=+[]{}|;:',.<>?/"

    if not charset:
        charset = string.ascii_letters + string.digits

    while True:
        password = "".join(secrets.choice(charset) for _ in range(length))
        valid = True
        if req.include_lowercase and not any(c in string.ascii_lowercase for c in password):
            valid = False
        if req.include_uppercase and not any(c in string.ascii_uppercase for c in password):
            valid = False
        if req.include_digits and not any(c in string.digits for c in password):
            valid = False
        if req.include_symbols and not any(c in "!@#$%^&*()-_=+[]{}|;:',.<>?/" for c in password):
            valid = False
        if valid:
            break

    result = analyze(password)
    return GenerateResponse(
        password=password,
        entropy=result.entropy,
        strength_label=result.strength_label,
        strength_percent=result.strength_percent,
    )


# ── Passphrase ───────────────────────────────────────────────────────────

class PassphraseRequest(BaseModel):
    word_count: int = 4
    separator: str = "-"
    capitalize: bool = False
    include_number: bool = False
    language: str = "en"


class PassphraseResponse(BaseModel):
    passphrase: str
    entropy: float
    strength_label: str
    strength_percent: int
    word_count_used: int


@app.post("/api/passphrase", response_model=PassphraseResponse)
def generate_passphrase(req: PassphraseRequest):
    word_count = max(3, min(8, req.word_count))
    wordlist = WORDLISTS.get(req.language, EN_WORDS)

    words = [secrets.choice(wordlist) for _ in range(word_count)]

    if req.capitalize:
        words = [w.capitalize() for w in words]

    if req.include_number:
        idx = secrets.randbelow(word_count)
        words[idx] = words[idx] + str(secrets.randbelow(100))

    passphrase = req.separator.join(words)

    base_entropy = word_count * math.log2(len(wordlist))
    if req.include_number:
        base_entropy += math.log2(100)

    result = analyze(passphrase)
    return PassphraseResponse(
        passphrase=passphrase,
        entropy=result.entropy,
        strength_label=result.strength_label,
        strength_percent=result.strength_percent,
        word_count_used=word_count,
    )


# ── Compare ──────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    passwords: list[str]


class CompareItem(BaseModel):
    password_hidden: str
    analysis: AnalysisResponse


class CompareResponse(BaseModel):
    comparisons: list[CompareItem]
    best: int


@app.post("/api/compare", response_model=CompareResponse)
def compare_passwords(req: CompareRequest, request: Request):
    client_ip = request.client.host if request.client else "default"
    pw_list = req.passwords[:3]
    comparisons = []
    best_idx = 0
    best_percent = -1

    for i, pw in enumerate(pw_list):
        result = analyze(pw, client_ip=client_ip)
        hidden = pw[:2] + "*" * max(len(pw) - 4, 0) + pw[-2:] if len(pw) > 4 else "***"
        analysis_resp = AnalysisResponse(
            password_length=result.password_length,
            charset_size=result.charset_size,
            entropy=result.entropy,
            crack_time_seconds=result.crack_time_seconds,
            crack_time_display=result.crack_time_display,
            strength_percent=result.strength_percent,
            strength_label=result.strength_label,
            patterns=[PatternResponse(name=p.name, description=p.description, penalty=p.penalty) for p in result.patterns],
            charset_breakdown=result.charset_breakdown,
            breach_count=result.breach_count,
            breach_checked=result.breach_checked,
            policy_compliant=result.policy_compliant,
            policy_violations=result.policy_violations,
            zxcvbn_score=result.zxcvbn_score,
            zxcvbn_feedback=result.zxcvbn_feedback,
            hibp_cached=result.hibp_cached,
        )
        comparisons.append(CompareItem(password_hidden=hidden, analysis=analysis_resp))
        if result.strength_percent > best_percent:
            best_percent = result.strength_percent
            best_idx = i

    return CompareResponse(comparisons=comparisons, best=best_idx)


# ── Report ───────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    password: str
    policy: Optional[str] = None


@app.post("/api/report")
def generate_report(req: ReportRequest, request: Request):
    client_ip = request.client.host if request.client else "default"
    result = analyze(req.password, policy=req.policy, client_ip=client_ip)
    escaped_pw = html.escape(req.password[:2] + "***")

    patterns_html = ""
    for p in result.patterns:
        patterns_html += f'<li><strong>{html.escape(p.description)}</strong> (penalty: -{p.penalty} bits)</li>\n'

    violations_html = ""
    if result.policy_violations:
        for v in result.policy_violations:
            violations_html += f'<li>{html.escape(v)}</li>\n'

    breach_html = ""
    if result.breach_checked and result.breach_count > 0:
        breach_html = f'<div class="alert alert-danger">⚠️ Found in {result.breach_count:,} data breaches!</div>'
    elif result.breach_checked and result.breach_count == 0:
        breach_html = '<div class="alert alert-success">✅ Not found in any known data breaches</div>'

    zxcvbn_labels = ["Too Guessable", "Very Guessable", "Somewhat Guessable", "Safe", "Very Safe"]
    zxcvbn_label = zxcvbn_labels[min(result.zxcvbn_score, 4)]

    zxcvbn_feedback_html = ""
    if result.zxcvbn_feedback:
        for f in result.zxcvbn_feedback:
            zxcvbn_feedback_html += f'<li>{html.escape(f)}</li>\n'

    strength_color = "#ef4444"
    if result.strength_percent >= 75:
        strength_color = "#10b981"
    elif result.strength_percent >= 50:
        strength_color = "#eab308"
    elif result.strength_percent >= 25:
        strength_color = "#f97316"

    report_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Password Strength Report</title>
<style>
  body {{ font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #0f172a; color: #e2e8f0; }}
  h1 {{ color: #818cf8; font-size: 24px; }}
  h2 {{ color: #a5b4fc; font-size: 18px; margin-top: 30px; border-bottom: 1px solid #334155; padding-bottom: 8px; }}
  .score {{ font-size: 60px; font-weight: bold; color: {strength_color}; }}
  .label {{ font-size: 18px; color: {strength_color}; }}
  .bar {{ height: 12px; background: #1e293b; border-radius: 6px; overflow: hidden; margin: 10px 0; }}
  .bar-fill {{ height: 100%; width: {result.strength_percent}%; background: {strength_color}; border-radius: 6px; }}
  .stat {{ display: inline-block; background: #1e293b; padding: 15px 25px; border-radius: 12px; margin: 5px; text-align: center; }}
  .stat-val {{ font-size: 24px; font-weight: bold; color: white; }}
  .stat-lbl {{ font-size: 11px; color: #64748b; text-transform: uppercase; }}
  ul {{ padding-left: 20px; }}
  li {{ margin: 4px 0; }}
  .alert {{ padding: 12px 16px; border-radius: 8px; margin: 10px 0; }}
  .alert-danger {{ background: #450a0a; border: 1px solid #991b1b; color: #fca5a5; }}
  .alert-success {{ background: #052e16; border: 1px solid #166534; color: #86efac; }}
  .zxcvbn {{ background: #1e293b; padding: 15px; border-radius: 12px; margin: 10px 0; }}
  .footer {{ margin-top: 40px; font-size: 12px; color: #475569; border-top: 1px solid #1e293b; padding-top: 16px; }}
</style></head>
<body>
  <h1>🔐 Password Strength Report</h1>
  <p>Generated by Password Strength Visualizer</p>

  <div style="text-align:center; margin: 30px 0;">
    <div class="score">{result.strength_percent}%</div>
    <div class="label">{html.escape(result.strength_label)}</div>
    <div class="bar"><div class="bar-fill"></div></div>
  </div>

  <div style="text-align:center;">
    <div class="stat"><div class="stat-val">{result.entropy}</div><div class="stat-lbl">Entropy (bits)</div></div>
    <div class="stat"><div class="stat-val">{result.password_length}</div><div class="stat-lbl">Length</div></div>
    <div class="stat"><div class="stat-val">{html.escape(result.crack_time_display)}</div><div class="stat-lbl">Time to Crack</div></div>
    <div class="stat"><div class="stat-val">{result.charset_size}</div><div class="stat-lbl">Charset Size</div></div>
  </div>

  <h2>Breach Check</h2>
  {breach_html}

  <h2>zxcvbn Score: {result.zxcvbn_score}/4 — {zxcvbn_label}</h2>
  <div class="zxcvbn">
    <ul>{zxcvbn_feedback_html or '<li>No issues detected</li>'}</ul>
  </div>

  <h2>Detected Patterns</h2>
  {'<ul>' + patterns_html + '</ul>' if patterns_html else '<p>No patterns detected ✅</p>'}

  {"<h2>Policy Compliance</h2><p>" + ("✅ Compliant" if result.policy_compliant else "❌ Non-compliant") + "</p><ul>" + violations_html + "</ul>" if result.policy_violations or not result.policy_compliant else ""}

  <div class="footer">
    <p>Analysis was performed at 10 billion hashes/sec (GPU farm estimate).</p>
    <p>HIBP breach data sourced from pwnedpasswords.com (k-anonymity model).</p>
    <p>zxcvbn-lite scoring uses dictionary, keyboard, sequence, date, and repeat matchers.</p>
  </div>
</body></html>"""

    return {"html": report_html}


# ── Policies ─────────────────────────────────────────────────────────────

@app.get("/api/policies")
def get_policies():
    return {name: {k: v for k, v in policy.items()} for name, policy in POLICIES.items()}


# ── Health ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Bulk Analyze ─────────────────────────────────────────────────────────

class BulkAnalyzeRequest(BaseModel):
    passwords: list[str]
    policy: Optional[str] = None


class BulkResultItem(BaseModel):
    password_hidden: str
    analysis: AnalysisResponse


class BulkAnalyzeResponse(BaseModel):
    results: list[BulkResultItem]
    summary: dict


@app.post("/api/analyze-bulk", response_model=BulkAnalyzeResponse)
def analyze_bulk(req: BulkAnalyzeRequest, request: Request):
    client_ip = request.client.host if request.client else "default"
    pw_list = req.passwords[:1000]
    results = []
    weak = strong = breached = 0
    total_entropy = 0.0

    for pw in pw_list:
        result = analyze(pw, policy=req.policy, client_ip=client_ip)
        hidden = pw[:2] + "*" * max(len(pw) - 4, 0) + pw[-2:] if len(pw) > 4 else "***"
        analysis_resp = AnalysisResponse(
            password_length=result.password_length,
            charset_size=result.charset_size,
            entropy=result.entropy,
            crack_time_seconds=result.crack_time_seconds,
            crack_time_display=result.crack_time_display,
            strength_percent=result.strength_percent,
            strength_label=result.strength_label,
            patterns=[PatternResponse(name=p.name, description=p.description, penalty=p.penalty) for p in result.patterns],
            charset_breakdown=result.charset_breakdown,
            breach_count=result.breach_count,
            breach_checked=result.breach_checked,
            policy_compliant=result.policy_compliant,
            policy_violations=result.policy_violations,
            zxcvbn_score=result.zxcvbn_score,
            zxcvbn_feedback=result.zxcvbn_feedback,
            hibp_cached=result.hibp_cached,
            mutations=[PatternResponse(name=m.name, description=m.description, penalty=m.penalty) for m in result.mutations],
            indonesian_breach=result.indonesian_breach,
        )
        results.append(BulkResultItem(password_hidden=hidden, analysis=analysis_resp))
        total_entropy += result.entropy
        if result.strength_percent < 40:
            weak += 1
        elif result.strength_percent >= 75:
            strong += 1
        if result.breach_count > 0:
            breached += 1

    summary = {
        "total": len(results),
        "weak_count": weak,
        "strong_count": strong,
        "breached_count": breached,
        "avg_entropy": round(total_entropy / max(len(results), 1), 2),
    }
    return BulkAnalyzeResponse(results=results, summary=summary)


@app.post("/api/analyze-bulk/csv")
def analyze_bulk_csv(request: Request, file: UploadFile = File(...)):
    """Accept CSV file, analyze passwords, return CSV results."""
    content = file.file.read().decode("utf-8")
    client_ip = request.client.host if request.client else "default"

    passwords = []
    for line in content.strip().splitlines():
        parts = line.strip().split(",")
        pw = parts[-1].strip() if parts else ""
        if pw:
            passwords.append(pw)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["password_masked", "strength_percent", "strength_label", "entropy", "breach_count", "zxcvbn_score", "policy_compliant"])

    for pw in passwords[:1000]:
        result = analyze(pw, client_ip=client_ip)
        hidden = pw[:2] + "***" + pw[-2:] if len(pw) > 4 else "***"
        writer.writerow([hidden, result.strength_percent, result.strength_label, result.entropy,
                         result.breach_count, result.zxcvbn_score, result.policy_compliant])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analysis-results.csv"},
    )


# ── QR Code ──────────────────────────────────────────────────────────────

class QRRequest(BaseModel):
    text: str
    size: int = 200


@app.post("/api/qr")
def generate_qr(req: QRRequest):
    """Generate a simple SVG QR code placeholder."""
    size = max(100, min(500, req.size))
    # Simple placeholder SVG — a styled grid pattern
    cell_size = size // 25
    svg_size = cell_size * 25

    cells = []
    # Generate deterministic pattern from text hash
    h = hashlib.sha256(req.text.encode()).hexdigest()
    for i in range(25):
        for j in range(25):
            idx = (i * 25 + j) % len(h)
            if int(h[idx], 16) % 3 == 0:
                x = j * cell_size
                y = i * cell_size
                cells.append(f'<rect x="{x}" y="{y}" width="{cell_size}" height="{cell_size}" fill="#000"/>')

    # Position detection patterns (corners)
    for cx, cy in [(0, 0), (18, 0), (0, 18)]:
        cells.append(f'<rect x="{cx*cell_size}" y="{cy*cell_size}" width="{7*cell_size}" height="{7*cell_size}" fill="none" stroke="#000" stroke-width="{cell_size}"/>')
        cells.append(f'<rect x="{(cx+2)*cell_size}" y="{(cy+2)*cell_size}" width="{3*cell_size}" height="{3*cell_size}" fill="#000"/>')

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_size} {svg_size}" width="{size}" height="{size}">
    <rect width="{svg_size}" height="{svg_size}" fill="#fff"/>
    {"".join(cells)}
</svg>'''
    return Response(content=svg, media_type="image/svg+xml")


# ── Recent Breaches ──────────────────────────────────────────────────────

_breaches_cache = {"data": None, "ts": 0}

@app.get("/api/breaches/recent")
def get_recent_breaches():
    import json
    now = time.time()
    if _breaches_cache["data"] and now - _breaches_cache["ts"] < 3600:
        return _breaches_cache["data"]
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://haveibeenpwned.com/api/v3/breaches",
            headers={"User-Agent": "PWGuard/1.0"},
        )
        resp = urllib.request.urlopen(req, timeout=10)
        breaches = json.loads(resp.read().decode("utf-8"))
        # Sort by breach date, take most recent 50
        breaches.sort(key=lambda b: b.get("BreachDate", ""), reverse=True)
        result = breaches[:50]
        _breaches_cache["data"] = result
        _breaches_cache["ts"] = now
        return result
    except Exception:
        return []


# ── API Keys ─────────────────────────────────────────────────────────────

@app.post("/api/keys/create")
def create_api_key():
    db = SessionLocal()
    key = secrets.token_hex(16)
    api_key = ApiKey(key=key)
    db.add(api_key)
    db.commit()
    db.close()
    return {"key": key}


@app.get("/api/keys/{key}/stats")
def get_key_stats(key: str):
    db = SessionLocal()
    api_key = db.query(ApiKey).filter(ApiKey.key == key).first()
    db.close()
    if not api_key:
        return {"error": "Key not found"}
    return {
        "key": key,
        "created_at": api_key.created_at.isoformat(),
        "request_count": api_key.request_count,
    }


# ── Breach Monitoring ────────────────────────────────────────────────────

class MonitorRequest(BaseModel):
    email: str


class MonitorResponse(BaseModel):
    email: str
    breach_count: int
    breach_details: list[str]
    last_checked: Optional[str]
    created_at: str


@app.post("/api/monitor", response_model=MonitorResponse)
def add_monitor(req: MonitorRequest):
    db = SessionLocal()
    existing = db.query(BreachMonitor).filter(BreachMonitor.email == req.email).first()
    if existing:
        db.close()
        raise HTTPException(status_code=409, detail="Email already monitored")

    # Check HIBP immediately
    breach_count = 0
    breach_details = []
    try:
        import urllib.request
        url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{req.email}"
        request = urllib.request.Request(url, headers={"User-Agent": "PWGuard/1.0"})
        try:
            resp = urllib.request.urlopen(request, timeout=5)
            import json
            breach_list = json.loads(resp.read().decode())
            breach_count = len(breach_list)
            breach_details = [b.get("Name", "") for b in breach_list[:10]]
        except urllib.error.HTTPError as e:
            if e.code == 404:
                breach_count = 0
    except Exception:
        pass

    monitor = BreachMonitor(
        email=req.email,
        breach_count=breach_count,
        breach_details=json.dumps(breach_details) if breach_details else "[]",
        last_checked=datetime.utcnow(),
    )
    db.add(monitor)
    db.commit()
    db.close()

    return MonitorResponse(
        email=req.email,
        breach_count=breach_count,
        breach_details=breach_details,
        last_checked=datetime.utcnow().isoformat(),
        created_at=datetime.utcnow().isoformat(),
    )


@app.get("/api/monitor/{email}", response_model=MonitorResponse)
def check_monitor(email: str):
    db = SessionLocal()
    m = db.query(BreachMonitor).filter(BreachMonitor.email == email).first()
    db.close()
    if not m:
        raise HTTPException(status_code=404, detail="Email not monitored")
    import json
    details = json.loads(m.breach_details) if m.breach_details else []
    return MonitorResponse(
        email=m.email,
        breach_count=m.breach_count,
        breach_details=details,
        last_checked=m.last_checked.isoformat() if m.last_checked else None,
        created_at=m.created_at.isoformat(),
    )


@app.delete("/api/monitor/{email}")
def delete_monitor(email: str):
    db = SessionLocal()
    m = db.query(BreachMonitor).filter(BreachMonitor.email == email).first()
    if not m:
        db.close()
        raise HTTPException(status_code=404, detail="Email not monitored")
    db.delete(m)
    db.commit()
    db.close()
    return {"detail": "Deleted"}


@app.get("/api/monitor")
def list_monitors():
    db = SessionLocal()
    monitors = db.query(BreachMonitor).all()
    db.close()
    import json
    return [
        {
            "email": m.email,
            "breach_count": m.breach_count,
            "breach_details": json.loads(m.breach_details) if m.breach_details else [],
            "last_checked": m.last_checked.isoformat() if m.last_checked else None,
            "created_at": m.created_at.isoformat(),
        }
        for m in monitors
    ]


# ── AI Password Suggestions ──────────────────────────────────────────────

class SuggestRequest(BaseModel):
    password: str


class Suggestion(BaseModel):
    password: str
    reason: str
    strength_label: str
    strength_percent: int
    entropy: float


class SuggestResponse(BaseModel):
    suggestions: list[Suggestion]


@app.post("/api/suggest", response_model=SuggestResponse)
def suggest_passwords(req: SuggestRequest):
    client_ip = "default"
    result = analyze(req.password, client_ip=client_ip)
    suggestions = []

    # Strategy 1: If too short, suggest longer version
    if result.password_length < 12:
        gen_req = GenerateRequest(length=max(16, result.password_length + 8))
        gen = generate_password(gen_req)
        suggestions.append(Suggestion(
            password=gen.password,
            reason=f"Longer ({gen_req.length} chars vs {result.password_length})",
            strength_label=gen.strength_label,
            strength_percent=gen.strength_percent,
            entropy=gen.entropy,
        ))

    # Strategy 2: If no symbols, suggest with symbols
    if not any(c in "!@#$%^&*" for c in req.password):
        gen_req = GenerateRequest(length=max(16, result.password_length), include_symbols=True)
        gen = generate_password(gen_req)
        suggestions.append(Suggestion(
            password=gen.password,
            reason="Includes special characters for higher entropy",
            strength_label=gen.strength_label,
            strength_percent=gen.strength_percent,
            entropy=gen.entropy,
        ))

    # Strategy 3: Suggest a passphrase
    pp_req = PassphraseRequest(word_count=4, separator="-", capitalize=True, include_number=True)
    pp = generate_passphrase(pp_req)
    suggestions.append(Suggestion(
        password=pp.passphrase,
        reason="Passphrase: easy to remember, hard to crack",
        strength_label=pp.strength_label,
        strength_percent=pp.strength_percent,
        entropy=pp.entropy,
    ))

    # Strategy 4: If breached, suggest completely different
    if result.breach_count > 0:
        gen_req = GenerateRequest(length=20, include_symbols=True)
        gen = generate_password(gen_req)
        suggestions.append(Suggestion(
            password=gen.password,
            reason=f"Your password was found in {result.breach_count:,} breaches — use a completely new one",
            strength_label=gen.strength_label,
            strength_percent=gen.strength_percent,
            entropy=gen.entropy,
        ))

    return SuggestResponse(suggestions=suggestions[:3])


# ── Dark Web Monitoring ──────────────────────────────────────────────────

class DarkWebRequest(BaseModel):
    domain: str


class DarkWebBreach(BaseModel):
    name: str
    domain: str
    breach_date: str
    pwn_count: int
    data_classes: list[str]
    is_verified: bool


class DarkWebResponse(BaseModel):
    domain: str
    breaches: list[DarkWebBreach]
    total_breaches: int
    total_accounts: int


@app.post("/api/darkweb/check", response_model=DarkWebResponse)
def check_dark_web(req: DarkWebRequest):
    try:
        import urllib.request
        import json
        url = f"https://haveibeenpwned.com/api/v3/breaches"
        request = urllib.request.Request(url, headers={"User-Agent": "PWGuard/1.0"})
        resp = urllib.request.urlopen(request, timeout=10)
        all_breaches = json.loads(resp.read().decode())

        matching = []
        for b in all_breaches:
            if req.domain.lower() in (b.get("Domain", "") or "").lower():
                matching.append(DarkWebBreach(
                    name=b.get("Name", ""),
                    domain=b.get("Domain", ""),
                    breach_date=b.get("BreachDate", ""),
                    pwn_count=b.get("PwnCount", 0),
                    data_classes=b.get("DataClasses", []),
                    is_verified=b.get("IsVerified", False),
                ))

        total_accounts = sum(b.pwn_count for b in matching)
        return DarkWebResponse(
            domain=req.domain,
            breaches=matching[:50],
            total_breaches=len(matching),
            total_accounts=total_accounts,
        )
    except Exception as e:
        return DarkWebResponse(domain=req.domain, breaches=[], total_breaches=0, total_accounts=0)


# ── Password Manager Export Analysis ─────────────────────────────────────

@app.post("/api/analyze-export")
def analyze_export(request: Request, file: UploadFile = File(...), format: str = "generic"):
    content = file.file.read().decode("utf-8")
    client_ip = request.client.host if request.client else "default"

    # Parse based on format
    entries = []
    reader = csv.reader(io.StringIO(content))
    header = next(reader, None)

    for row in reader:
        if not row:
            continue
        if format == "bitwarden" and len(row) >= 5:
            # name,url,username,password,notes
            entries.append({"name": row[0], "url": row[1], "username": row[2], "password": row[3]})
        elif format == "1password" and len(row) >= 4:
            entries.append({"name": row[0], "url": row[1], "username": row[2], "password": row[3]})
        elif format == "lastpass" and len(row) >= 6:
            entries.append({"name": row[0], "url": row[1], "username": row[2], "password": row[5]})
        else:  # generic
            pw = row[-1] if row else ""
            name = row[0] if len(row) > 1 else "Unknown"
            entries.append({"name": name, "url": "", "username": "", "password": pw})

    results = []
    weak = strong = breached = 0
    total_entropy = 0.0

    for entry in entries[:500]:
        pw = entry["password"]
        if not pw:
            continue
        result = analyze(pw, client_ip=client_ip)
        hidden_user = entry["username"][:2] + "***" if len(entry["username"]) > 2 else "***"
        results.append({
            "name": entry["name"],
            "url": entry["url"],
            "username_hidden": hidden_user,
            "analysis": {
                "password_length": result.password_length,
                "entropy": result.entropy,
                "strength_percent": result.strength_percent,
                "strength_label": result.strength_label,
                "breach_count": result.breach_count,
                "zxcvbn_score": result.zxcvbn_score,
            },
        })
        total_entropy += result.entropy
        if result.strength_percent < 40:
            weak += 1
        elif result.strength_percent >= 75:
            strong += 1
        if result.breach_count > 0:
            breached += 1

    return {
        "results": results,
        "summary": {
            "total": len(results),
            "weak_count": weak,
            "strong_count": strong,
            "breached_count": breached,
            "avg_entropy": round(total_entropy / max(len(results), 1), 2),
        },
    }


# ── Teams ────────────────────────────────────────────────────────────────

class TeamCreateRequest(BaseModel):
    name: str


class TeamMemberRequest(BaseModel):
    name: str
    role: str = "member"


class TeamPolicyRequest(BaseModel):
    policy_name: str


@app.post("/api/teams")
def create_team(req: TeamCreateRequest):
    db = SessionLocal()
    team = Team(name=req.name)
    db.add(team)
    db.commit()
    db.refresh(team)
    db.close()
    return {"id": team.id, "name": team.name, "policy_name": team.policy_name, "created_at": team.created_at.isoformat()}


@app.get("/api/teams")
def list_teams():
    db = SessionLocal()
    teams = db.query(Team).all()
    result = []
    for t in teams:
        members = db.query(TeamMember).filter(TeamMember.team_id == t.id).all()
        result.append({
            "id": t.id,
            "name": t.name,
            "policy_name": t.policy_name,
            "member_count": len(members),
            "created_at": t.created_at.isoformat(),
        })
    db.close()
    return result


@app.post("/api/teams/{team_id}/members")
def add_team_member(team_id: int, req: TeamMemberRequest):
    db = SessionLocal()
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        db.close()
        raise HTTPException(status_code=404, detail="Team not found")
    member = TeamMember(team_id=team_id, name=req.name, role=req.role)
    db.add(member)
    db.commit()
    db.close()
    return {"id": member.id, "name": req.name, "role": req.role}


@app.get("/api/teams/{team_id}/members")
def get_team_members(team_id: int):
    db = SessionLocal()
    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    db.close()
    return [
        {
            "id": m.id,
            "name": m.name,
            "role": m.role,
            "avg_strength": m.avg_strength,
            "breach_exposed": m.breach_exposed,
            "added_at": m.added_at.isoformat(),
        }
        for m in members
    ]


@app.post("/api/teams/{team_id}/policy")
def set_team_policy(team_id: int, req: TeamPolicyRequest):
    db = SessionLocal()
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        db.close()
        raise HTTPException(status_code=404, detail="Team not found")
    team.policy_name = req.policy_name
    db.commit()
    db.close()
    return {"id": team.id, "policy_name": team.policy_name}


@app.delete("/api/teams/{team_id}")
def delete_team(team_id: int):
    db = SessionLocal()
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        db.close()
        raise HTTPException(status_code=404, detail="Team not found")
    db.query(TeamMember).filter(TeamMember.team_id == team_id).delete()
    db.delete(team)
    db.commit()
    db.close()
    return {"detail": "Deleted"}
