require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// api rate limit
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60 }));

// serve only the public folder
app.use(express.static(path.join(__dirname, 'public')));

// routes

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: message }],
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return res.json({ response: content });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Minimal health check (don’t reveal key details)
app.get('/api/test', (_req, res) => {
  res.json({ ok: true });
});

// Serve index.html from /public
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
