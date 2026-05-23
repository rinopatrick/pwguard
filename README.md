# pwguard

Real-time password strength analyzer with modern UI.

**[Live Demo](http://localhost:5173)** | **[API Docs](http://localhost:8001/docs)**

## Features

- **Password Analysis** — entropy, crack time (10B hashes/sec GPU), pattern detection
- **zxcvbn Scoring** — dictionary-based matching (0-4 scale, like Dropbox)
- **HIBP Breach Check** — checks against Have I Been Pwned database (k-anonymity, password never sent)
- **Password Generator** — cryptographically secure (`secrets`), 8-128 chars, charset toggles
- **Passphrase Mode** — English + Bahasa Indonesia (2048 words), 3-8 words
- **Password Compare** — side-by-side comparison of 2-3 passwords
- **HTML Report Export** — downloadable styled report
- **Strength Policies** — NIST, PCI-DSS, Corporate, Basic compliance checks
- **Custom Wordlist** — forbidden words detection
- **Keyboard Layout Detection** — QWERTY, Dvorak, Colemak walk patterns
- **Bookmarklet** — drag-to-bookmark strength checker for any website

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8001

# Frontend
cd frontend
npm install
npm run dev -- --port 5173
```

Or use the start script:
```bash
./start.sh
```

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion
- **Backend:** Python FastAPI
- **Analysis:** Custom engine + HIBP API (k-anonymity)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Full password analysis |
| `/api/generate` | POST | Generate random password |
| `/api/passphrase` | POST | Generate passphrase (en/id) |
| `/api/compare` | POST | Compare 2-3 passwords |
| `/api/report` | POST | HTML report export |
| `/api/policies` | GET | List strength policies |

## License

MIT
