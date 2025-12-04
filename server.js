require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini client
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
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
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net"
    ],
    "style-src-elem": [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net"
    ],
    "font-src": [
      "'self'",
      "https:",
      "data:",
      "https://fonts.gstatic.com",
      "https://cdn.jsdelivr.net"
    ],
    "img-src": [
      "'self'",
      "data:",
      "https:",
      "blob:",
      "filesystem:"
    ],
    "media-src": [
      "'self'",
      "blob:",
      "data:"
    ],
    "connect-src": [
      "'self'",
      "https://generativelanguage.googleapis.com",
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

// Serve static files
app.get('/style.css', (_req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/script.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});
app.get('/spline-particles.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'spline-particles.js'));
});

// Serve Public folder (images, logos, etc.)
app.use('/Public', express.static(path.join(__dirname, 'Public')));

// Serve Private folder (case study videos, etc.)
app.use('/Private', express.static(path.join(__dirname, 'Private')));

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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    console.log(`📨 Request: "${message}"`);
    
    // REMOVE keyword check for image requests to allow cleaner testing/usage if desired
    // or keep it but make it very broad.
    // For now, to "not need an explicit draw command", we can default to image generation
    // unless it looks like a question? Or just use a "smart" check.
    
    // Let's try asking the LLM to classify intent instead of simple keyword matching.
    // This is more robust.
    
    // For this fix, we'll assume everything is an image request unless it's clearly a chat.
    // Or we can just REMOVE the "isImageRequest" check entirely and always try to generate an image
    // if that is the primary purpose of this app (Spline Particles tracer).
    
    // Based on user request "thought we changed it such that it didn't need an explicit 'draw'":
    const isImageRequest = true; 

    console.log(`🎨 Is image request: ${isImageRequest}`);

    if (isImageRequest) {
      console.log('🎨 Starting image generation with Gemini...');
      
      try {
        // Use Gemini's image generation (gemini-2.5-flash-image) as primary method
        // This produces better quality results than SVG generation
        const subject = message.trim();
        const imagePrompt = `Clean vector line art of ${subject}, minimalistic black outline, no fill, smooth continuous lines, uniform line weight, black background, white lines, SVG style, professional design, no shading, high contrast, sharp edges, symmetrical composition.`;
        
        try {
          const imageModel = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
          console.log(`🎨 Generating image with ${imageModel}...`);
          
          const imgResponse = await client.models.generateContent({
            model: imageModel,
            contents: imagePrompt,
            config: {
              responseModalities: ['Image']
            }
          });
          
          // Extract image data from response parts
          // Check different possible response structures
          let imageBase64 = null;
          let parts = null;
          
          // Try different response structures
          if (Array.isArray(imgResponse.parts)) {
            parts = imgResponse.parts;
          } else if (imgResponse.response && Array.isArray(imgResponse.response.parts)) {
            parts = imgResponse.response.parts;
          } else if (imgResponse.candidates && imgResponse.candidates[0] && Array.isArray(imgResponse.candidates[0].content?.parts)) {
            parts = imgResponse.candidates[0].content.parts;
          } else {
            // Log the response structure for debugging
            console.error('Unknown response structure:', Object.keys(imgResponse));
            console.error('Response type:', typeof imgResponse);
            throw new Error('Unknown response structure from Gemini API');
          }
          
          // Extract image data from parts
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              imageBase64 = part.inlineData.data;
              break;
            } else if (part.inline_data && part.inline_data.data) {
              // Alternative naming
              imageBase64 = part.inline_data.data;
              break;
            }
          }
          
          if (!imageBase64) {
            // Log the response structure for debugging
            console.error('No image data found. Response structure:', JSON.stringify(imgResponse, null, 2).substring(0, 1000));
            throw new Error('No image data in response');
          }
          
          console.log(`✅ Image generated, length: ${imageBase64.length}`);
          
          return res.json({
            response: "I've created an image for you! The particles will now trace its outline.",
            imageData: imageBase64,
            imageMime: 'image/png',
            isImage: true
          });
          
        } catch (imgGenError) {
          console.error('❌ Gemini image generation failed:', imgGenError);
          return res.status(500).json({ 
            error: 'Image generation failed',
            details: imgGenError.message || 'SVG outline generation was not successful. Please try again or rephrase your request.'
          });
        }
        
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
        const chatModel = process.env.CHAT_MODEL || 'gemini-2.0-flash-exp';
        const response = await client.models.generateContent({
          model: chatModel,
          contents: message
        });

        const content = response.text;
        
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
  console.log(`🎨 Image generation: Gemini (${process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'})`);
  console.log(`💬 Text chat: ${process.env.CHAT_MODEL || 'gemini-2.0-flash-exp'}`);
  console.log(`🔑 API Key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
});

// --- helpers ---
async function generateSvgOutlineWithLLM(client, userPrompt) {
  // Prefer a powerful model; allow env override
  // Use IMAGE_MODEL for SVG generation (supports nano banana model)
  const model = process.env.IMAGE_MODEL || process.env.OUTLINE_MODEL || 'gemini-2.0-flash-exp';
  const system = `You generate minimal SVG outlines suitable for particle tracing.
Rules:
- Output ONLY a self-contained <svg> element. No markdown, no explanation.
- Size: width=1024 height=1024 viewBox="0 0 1024 1024".
- Background: solid black rectangle (#000000).
- Foreground: white stroke (#ffffff), stroke-width=14, no fill.
- Use one or a few <path>/<circle>/<rect>/<polygon> elements, centered and scaled to fit.
- CRITICAL: Only the main outline shape. NO scattered dots, NO isolated pixels, NO specks, NO decorative elements, NO background elements, NO text, NO watermark.
- The outline must be a single continuous path or a few connected paths forming the main shape.
- Think vector illustration - clean lines only, no noise, no artifacts.
`;
  const prompt = `Create a clean vector-style outline-only SVG for: ${userPrompt}. The outline must be a single continuous shape with no stray dots, specks, or isolated pixels. Only the main subject outline.`;
  try {
    const fullPrompt = `${system}\n\n${prompt}`;
    const resp = await client.models.generateContent({
      model: model,
      contents: fullPrompt,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1800
      }
    });
    let svg = resp.text.trim();
    if (!svg.includes('<svg')) return '';
    
    // Extract only the SVG content (remove any text before <svg>)
    const svgStart = svg.indexOf('<svg');
    if (svgStart > 0) {
      svg = svg.substring(svgStart);
    }
    
    // Find the closing </svg> tag
    const svgEnd = svg.lastIndexOf('</svg>');
    if (svgEnd > 0) {
      svg = svg.substring(0, svgEnd + 6); // +6 for '</svg>'
    }
    
    // Normalize critical attributes and stroke styles
    // First, remove existing problematic attributes to avoid duplicates
    svg = svg
      .replace(/\s+width="[^"]*"/gi, '')
      .replace(/\s+height="[^"]*"/gi, '')
      .replace(/\s+viewBox="[^"]*"/gi, '')
      .replace(/xmlns="[^"]*"/gi, '');
    
    // Now add the correct attributes
    svg = svg
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"')
      .replace(/fill="[^"]*"/g, 'fill="none"')
      .replace(/stroke="[^"]*"/g, 'stroke="#ffffff"')
      .replace(/stroke-width="[^"]*"/g, 'stroke-width="14"');
    
    // Ensure black background (only if not already present)
    if (!svg.includes('<rect') || !svg.includes('fill="#000000"')) {
      svg = svg.replace(/<svg([^>]*)>/, '<svg$1><rect width="100%" height="100%" fill="#000000"/>');
    }
    
    return svg;
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