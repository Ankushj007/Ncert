// ============================================================
//   VidyaSetu Backend — server.js
//   Node.js + Express backend for the NCERT AI Tutor
//   Handles: Claude AI (streaming), CORS, rate limiting
// ============================================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const https      = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Validate required env vars on startup ─────────────────
const REQUIRED_KEYS = ['ANTHROPIC_API_KEY'];
for (const key of REQUIRED_KEYS) {
  if (!process.env[key] || process.env[key].includes('PASTE_YOUR')) {
    console.error(`\n❌  Missing env var: ${key}`);
    console.error(`    Open .env and add your ${key}\n`);
    process.exit(1);
  }
}
console.log('✅  All required API keys loaded');

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves index.html

// CORS — allow your frontend origin
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  methods: ['GET', 'POST'],
}));

// Rate limiter — prevent API key abuse
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,                               // 1 hour
  max: parseInt(process.env.RATE_LIMIT_PER_HOUR) || 30,
  message: { error: 'Too many questions! Please wait an hour before asking more.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      claude:    !!process.env.ANTHROPIC_API_KEY,
      openai:    !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('PASTE'),
      pinecone:  !!process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.includes('PASTE'),
      firebase:  !!process.env.FIREBASE_API_KEY && !process.env.FIREBASE_API_KEY.includes('PASTE'),
    }
  });
});

// ── Claude AI — Streaming Endpoint ───────────────────────
// POST /api/ask  { question, classVal, subjectVal }
app.post('/api/ask', aiLimiter, async (req, res) => {
  const { question, classVal, subjectVal } = req.body;

  if (!question || !classVal || !subjectVal) {
    return res.status(400).json({ error: 'question, classVal and subjectVal are required.' });
  }

  const systemPrompt = `You are a concise NCERT tutor for Indian students studying in ${classVal}, subject: ${subjectVal}.
Answer ONLY from the NCERT ${subjectVal} syllabus for ${classVal}.
Rules:
• Keep answer SHORT — max 5 bullet points
• Use simple language suitable for the grade
• Start directly with the answer, no preamble
• Use • for bullet points
• End with exactly one line: "📘 NCERT ${subjectVal} · ${classVal} — Chapter: [best chapter name]"`;

  // Set up SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Build Anthropic request body
  const body = JSON.stringify({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    stream:     true,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: question }],
  });

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(body),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    apiRes.on('data', (chunk) => {
      // Forward raw SSE chunks from Anthropic → browser
      res.write(chunk);
    });
    apiRes.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
    apiRes.on('error', (err) => {
      console.error('Anthropic stream error:', err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  });

  apiReq.on('error', (err) => {
    console.error('Request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to reach Claude API.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  apiReq.write(body);
  apiReq.end();

  // Clean up if client disconnects
  req.on('close', () => { apiReq.destroy(); });
});

// ── NCERT PDF Proxy (avoids CORS issues downloading PDFs) ─
// GET /api/pdf?url=https://ncert.nic.in/...
app.get('/api/pdf', (req, res) => {
  const { url } = req.query;

  // Only allow NCERT official domain
  if (!url || !url.startsWith('https://ncert.nic.in/')) {
    return res.status(400).json({ error: 'Only NCERT official PDFs are allowed.' });
  }

  const fileName = url.split('/').pop() || 'ncert-book.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  https.get(url, (pdfRes) => {
    if (pdfRes.statusCode !== 200) {
      return res.status(pdfRes.statusCode).json({ error: 'PDF not found on NCERT server.' });
    }
    pdfRes.pipe(res);
  }).on('error', (err) => {
    res.status(500).json({ error: 'Failed to fetch PDF: ' + err.message });
  });
});

// ── Start server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  VidyaSetu backend running at http://localhost:${PORT}`);
  console.log(`📚  Open http://localhost:${PORT} in your browser\n`);
});
