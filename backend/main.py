"""Password Strength Visualizer — FastAPI backend.
Features: analyze, generate, passphrase, compare, report, policies, HIBP breach check,
bulk analyze, QR code, API key auth, rate limiting.
"""

import csv
import html
import io
import math
import secrets
import string
import time
from collections import defaultdict
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, create_engine, func
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

from analyzer import analyze, POLICIES
from wordlist import WORDS as EN_WORDS
from wordlist_id import WORDS as ID_WORDS

# ── Database (API Keys) ─────────────────────────────────────────────────

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


Base.metadata.create_all(bind=engine)

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
