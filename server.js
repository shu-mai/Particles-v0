require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// middleware
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "https://unpkg.com",
      "https://cdn.jsdelivr.net",
      "https://cdn.skypack.dev"
    ],
    "script-src-elem": [
      "'self'",
      "https://unpkg.com",
      "https://cdn.jsdelivr.net",
      "https://cdn.skypack.dev"
    ],
    "style-src": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com"
    ],
    "style-src-elem": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com"
    ],
    "font-src": [
      "'self'",
      "https:",
      "data:",
      "https://fonts.gstatic.com"
    ],
    "img-src": [
      "'self'",
      "data:",
      "https:"
    ],
    "connect-src": [
      "'self'",
      "https://api.openai.com",
      "https://cdn.jsdelivr.net",
      "https://unpkg.com",
      "https://cdn.skypack.dev",
      "https://prod.spline.design",
      "https://assets.spline.design"
    ],
    "object-src": ["'none'"]
  }
}));

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  methods: ['GET','POST','OPTIONS'],
}));
app.use(express.json({ limit: '10mb' })); // Increased for base64 images

// Restrict static file serving to explicit routes (avoid exposing entire directory)
app.get('/style.css', (_req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/script.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});
app.get('/spline-particles.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'spline-particles.js'));
});
app.get('/Files/arrow-right.svg', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Files', 'arrow-right.svg'));
});

// api rate limit
const chatLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

// routes

// Chat endpoint with image generation support
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
    }

    // Check if this is an image generation request
    const imageKeywords = ['draw', 'sketch', 'create image', 'visualize', 'picture', 'illustration', 'design', 'paint', 'render', 'generate image'];
    const isImageRequest = imageKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    console.log(`📨 Request: "${message}"`);
    console.log(`🎨 Is image request: ${isImageRequest}`);

    if (isImageRequest) {
      console.log('🎨 Starting image generation with DALL-E 3...');
      
      try {
        // Simple-shape override: generate deterministic SVG for basic shapes
        const simpleShapes = ['heart','star','circle','triangle','square','hexagon'];
        const lower = message.toLowerCase();
        const matched = simpleShapes.find(s => lower.includes(s));
        if (matched) {
          console.log(`🧩 Using procedural SVG for shape: ${matched}`);
          const svg = buildShapeSVG(matched);
          const base64 = Buffer.from(svg, 'utf8').toString('base64');
          return res.json({
            response: "I've created an image for you! The particles will now trace its outline.",
            imageData: base64,
            imageMime: 'image/svg+xml',
            isImage: true
          });
        }

        // Strong intermediary: ask an LLM to synthesize a clean SVG outline from the prompt
        // This avoids photoreal detail and stylization entirely.
        try {
          const rawSvg = await generateSvgOutlineWithLLM(openai, message);
          const svg = rawSvg ? sanitizeSvg(rawSvg) : '';
          if (svg && svg.includes('<svg')) {
            console.log('🧠 Using LLM-generated SVG outline');
            const base64 = Buffer.from(svg, 'utf8').toString('base64');
            return res.json({
              response: "I've created an image for you! The particles will now trace its outline.",
              imageData: base64,
              imageMime: 'image/svg+xml',
              isImage: true
            });
          }
        } catch (svgErr) {
          console.warn('SVG outline generation failed; falling back to DALL·E:', svgErr.message);
        }

        // Steer generation toward a clean outline (reduces specks/outliers)
        const outlineGuidance = `\nStyle: minimalist, single continuous outline of the subject. Solid black background. White stroke only. No shading, no fill, no texture, no background elements, no sparkles, no scattered dots, no text, no watermark. Centered, high contrast, clear silhouette.`;
        const improvedPrompt = `${message.trim()}\n${outlineGuidance}`;
        
        // Use configurable model, default to a non-DALL·E option; fallback to DALL·E if needed
        const preferredModel = process.env.IMAGE_MODEL || 'gpt-image-1-mini';
        let imgGenResponse;
        try {
          imgGenResponse = await openai.images.generate({
            model: preferredModel,
            prompt: improvedPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard"
          });
          console.log(`✅ Image generated with ${preferredModel}`);
        } catch (primaryErr) {
          console.warn(`⚠️ ${preferredModel} failed, falling back to dall-e-3:`, primaryErr.message);
          imgGenResponse = await openai.images.generate({
            model: 'dall-e-3',
            prompt: improvedPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard"
          });
          console.log('✅ Image generated with dall-e-3 (fallback)');
        }

        const imageUrl = imgGenResponse.data[0].url;
        console.log('✅ DALL-E 3 image generated:', imageUrl);
        
        // Download and convert to base64
        console.log('📥 Downloading image...');
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        
        console.log(`✅ Image converted to base64, length: ${imageBase64.length}`);
        
        return res.json({
          response: "I've created an image for you! The particles will now trace its outline.",
          imageData: imageBase64,
          imageMime: 'image/png',
          isImage: true
        });
        
      } catch (imageError) {
        console.error('❌ Image generation failed:', imageError);
        console.error('Error details:', imageError.message);
        return res.status(500).json({ 
          error: 'Image generation failed',
          details: imageError.message 
        });
      }

    } else {
      // Regular text chat
      console.log('💬 Using regular chat completion...');
      
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: message }],
          max_tokens: 4000
        });

        const content = completion.choices[0].message.content;
        
        console.log('✅ Chat response received');
        
        return res.json({ response: content, isImage: false });

      } catch (chatError) {
        console.error('❌ Chat API error:', chatError);
        return res.status(500).json({ 
          error: 'Chat API error',
          details: chatError.message 
        });
      }
    }

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

// Health check
app.get('/api/test', (_req, res) => {
  res.json({ ok: true });
});

// Serve index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🎨 Image generation: Responses API (gpt-5)`);
  console.log(`💬 Text chat: gpt-4o`);
  console.log(`🔑 API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
});

// --- helpers ---
async function generateSvgOutlineWithLLM(openai, userPrompt) {
  // Prefer a powerful model; allow env override
  const model = process.env.OUTLINE_MODEL || 'gpt-5';
  const system = `You generate minimal SVG outlines suitable for particle tracing.
Rules:
- Output ONLY a self-contained <svg> element. No markdown, no explanation.
- Size: width=1024 height=1024 viewBox="0 0 1024 1024".
- Background: solid black rectangle.
- Foreground: white stroke (#ffffff), stroke-width=14, no fill.
- Use one or a few <path>/<circle>/<rect>/<polygon> elements, centered and scaled to fit.
- No text, watermark, or decorative specks.
- Favor a single continuous path when reasonable.
`;
  const prompt = `Create a clean outline-only SVG for: ${userPrompt}`;
  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1800
    });
    const svg = resp.choices?.[0]?.message?.content?.trim() || '';
    if (!svg.includes('<svg')) return '';
    // Normalize critical attributes and stroke styles
    return svg
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"')
      .replace(/fill="[^"]*"/g, 'fill="none"')
      .replace(/stroke="[^"]*"/g, 'stroke="#ffffff"')
      .replace(/stroke-width="[^"]*"/g, 'stroke-width="14"')
      // ensure black background
      .replace(/<svg([^>]*)>/, '<svg$1><rect width="100%" height="100%" fill="#000000"/>');
  } catch (_e) {
    return '';
  }
}
function buildShapeSVG(kind) {
  const size = 1024;
  const stroke = 14;
  const strokeColor = '#ffffff';
  const bg = '#000000';
  const half = size / 2;
  const margin = 90;
  if (kind === 'heart') {
    // Path adapted for centered heart
    const path = `M ${half} ${half+120} C ${half-260} ${half-60}, ${half-60} ${half-270}, ${half} ${half-110} C ${half+60} ${half-270}, ${half+260} ${half-60}, ${half} ${half+120} Z`;
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (kind === 'circle') {
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><circle cx="${half}" cy="${half}" r="${half - margin}" fill="none" stroke="${strokeColor}" stroke-width="${stroke}"/>`);
  }
  if (kind === 'square') {
    const s = size - margin * 2;
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><rect x="${margin}" y="${margin}" width="${s}" height="${s}" fill="none" stroke="${strokeColor}" stroke-width="${stroke}"/>`);
  }
  if (kind === 'triangle') {
    const x1 = half, y1 = margin;
    const x2 = size - margin, y2 = size - margin;
    const x3 = margin, y3 = size - margin;
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><path d="M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z" fill="none" stroke="${strokeColor}" stroke-width="${stroke}" stroke-linejoin="round"/>`);
  }
  if (kind === 'hexagon') {
    const r = half - margin;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      pts.push(`${half + r * Math.cos(a)} ${half + r * Math.sin(a)}`);
    }
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><path d="M ${pts.join(' L ')} Z" fill="none" stroke="${strokeColor}" stroke-width="${stroke}" stroke-linejoin="round"/>`);
  }
  if (kind === 'star') {
    const R = half - margin; const r = R * 0.45;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI/2 + i * Math.PI/5;
      const rad = i % 2 === 0 ? R : r;
      pts.push(`${half + rad * Math.cos(a)} ${half + rad * Math.sin(a)}`);
    }
    return svgWrap(size, `<rect width="100%" height="100%" fill="${bg}"/><path d="M ${pts.join(' L ')} Z" fill="none" stroke="${strokeColor}" stroke-width="${stroke}" stroke-linejoin="round"/>`);
  }
  // default circle
  return buildShapeSVG('circle');
}

function svgWrap(size, content) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${content}</svg>`;
}

// Basic server-side SVG sanitizer to remove risky elements/attributes
function sanitizeSvg(svg) {
  return svg
    // remove script blocks
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    // remove event handler attributes like onload="..."
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    // remove foreignObject
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    // block javascript: URLs
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/xlink:href="javascript:[^"]*"/gi, 'xlink:href="#"')
    // disallow external references
    .replace(/xlink:href="http[^"]*"/gi, '')
    .replace(/href="http[^"]*"/gi, '')
}