# pwguard

Real-time password strength analyzer with modern UI.

**[API Docs](http://localhost:8001/docs)**

## Features

- **Password Analysis** — entropy, crack time (10B hashes/sec GPU), pattern detection
- **zxcvbn Scoring** — dictionary-based matching (0-4 scale, like Dropbox)
- **HIBP Breach Check** — checks against Have I Been Pwned database (k-anonymity, password never sent)
- **Indonesian Breach Database** — local database of commonly breached Indonesian passwords
- **Password Mutation Detection** — detects common mutations (append number, leet speak, reverse, double, suffix)
- **Password Generator** — cryptographically secure (`secrets`), 8-128 chars, charset toggles
- **Passphrase Mode** — English + Bahasa Indonesia (2048 words), 3-8 words
- **Password Compare** — side-by-side comparison of 2-3 passwords
- **Bulk Password Check** — analyze up to 1000 passwords at once, CSV upload/export
- **Strength Dashboard** — aggregate stats from analysis history (distribution, avg entropy, breach rate)
- **Custom Policy Builder** — visual editor for password policies with live preview and export
- **HTML Report Export** — downloadable styled report
- **Strength Policies** — NIST, PCI-DSS, Corporate, Basic compliance checks
- **Custom Wordlist** — forbidden words detection
- **Keyboard Layout Detection** — QWERTY, Dvorak, Colemak walk patterns
- **Bookmarklet** — drag-to-bookmark strength checker for any website
- **Embed Widget** — `<script>` tag for any website, shows strength meter on password fields
- **PWA Support** — installable, offline capability, service worker caching
- **Dark/Light Theme** — toggle between themes, stored in localStorage
- **Multi-language UI** — English + Bahasa Indonesia (all UI text translated)
- **API Key Auth** — rate limiting (100 req/hr), key management
- **Browser Extension** — Chrome/Firefox Manifest V3 extension (structural placeholder)

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

## Embed Widget

Add a password strength meter to any website:

```html
<script src="https://your-domain.com/widget.js"
  data-api-url="https://your-domain.com"
  data-theme="dark"
  data-position="below">
</script>
```

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion
- **Backend:** Python FastAPI, SQLite (API keys)
- **Analysis:** Custom engine + HIBP API (k-anonymity) + zxcvbn-lite + Indonesian breach DB

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Full password analysis |
| `/api/analyze-bulk` | POST | Bulk analysis (up to 1000) |
| `/api/analyze-bulk/csv` | POST | Bulk analysis from CSV file |
| `/api/generate` | POST | Generate random password |
| `/api/passphrase` | POST | Generate passphrase (en/id) |
| `/api/compare` | POST | Compare 2-3 passwords |
| `/api/report` | POST | HTML report export |
| `/api/qr` | POST | QR code SVG generation |
| `/api/policies` | GET | List strength policies |
| `/api/keys/create` | POST | Create API key |
| `/api/keys/{key}/stats` | GET | API key usage stats |

## License

MIT
