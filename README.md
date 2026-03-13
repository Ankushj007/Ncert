# VidyaSetu – NCERT Library & AI Tutor
### Full-Stack Setup Guide

---

## 📁 Project Structure

```
vidyasetu-backend/
├── server.js          ← Node.js backend (API key lives here, NEVER in browser)
├── .env               ← Your secret API keys (never share or commit this)
├── package.json       ← Dependencies
├── public/
│   └── index.html     ← The full website frontend
└── README.md
```

---

## ⚡ Quick Start (5 steps)

### Step 1 — Install Node.js
Download from https://nodejs.org (choose LTS version)

### Step 2 — Install dependencies
```bash
cd vidyasetu-backend
npm install
```

### Step 3 — Add your API keys to `.env`

Open `.env` and replace the placeholder values:

| Key | Where to get it | Required? |
|-----|----------------|-----------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ | ✅ Yes |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Optional (for RAG) |
| `PINECONE_API_KEY` | https://app.pinecone.io/ | Optional (for RAG) |
| `FIREBASE_API_KEY` | https://console.firebase.google.com/ | Optional (for auth) |

> **Minimum requirement:** Only `ANTHROPIC_API_KEY` is needed to run the AI tutor.

### Step 4 — Start the server
```bash
node server.js
```
You should see:
```
✅  All required API keys loaded
🚀  VidyaSetu backend running at http://localhost:3000
```

### Step 5 — Open the website
Go to http://localhost:3000 in your browser. That's it!

---

## 🔌 API Endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `GET  /api/health` | GET | Check which services are connected |
| `POST /api/ask` | POST | Send a question → get streamed AI answer |
| `GET  /api/pdf?url=...` | GET | Proxy-download NCERT PDFs without CORS issues |

### Example: Ask a question
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is photosynthesis?","classVal":"Class 10","subjectVal":"Science"}'
```

---

## 🔒 Security Notes

- **API keys are ONLY in `.env` on your server** — never exposed to the browser
- Rate limiting: 30 AI questions per IP per hour (configurable in `.env`)
- PDF proxy only allows `ncert.nic.in` domain — no arbitrary URL fetching
- CORS is restricted to your frontend origin only

---

## 🚀 Deploy to Production

### Option A — Railway (easiest, free tier)
1. Push this folder to GitHub (make sure `.env` is in `.gitignore`)
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard (same keys as `.env`)
4. Railway gives you a live URL automatically

### Option B — Render
1. Go to https://render.com → New Web Service
2. Connect GitHub repo, set build command: `npm install`
3. Set start command: `node server.js`
4. Add env vars in Render dashboard

### Option C — VPS (DigitalOcean / AWS EC2)
```bash
# On your server
git clone your-repo
cd vidyasetu-backend
npm install
# Copy .env with your keys
node server.js
# Use PM2 to keep it running
npm install -g pm2
pm2 start server.js --name vidyasetu
pm2 save
```

---

## 🔮 Future Features (RAG Architecture)

To make the AI answer directly FROM NCERT book content:

1. **Download all NCERT PDFs** from ncert.nic.in
2. **Extract text** using `pdf-parse` npm package
3. **Chunk** into 500-token pieces per chapter
4. **Embed** with OpenAI `text-embedding-3-small`
5. **Store** in Pinecone vector database
6. **On question**: embed query → vector search → get top 5 chunks → send to Claude
7. Claude answers with exact textbook context → 100% NCERT-accurate answers

This is already set up in `.env` — just add your Pinecone + OpenAI keys and implement the indexing script.
