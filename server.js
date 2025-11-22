require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3003;

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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    // All prompts are treated as image generation requests
    console.log(`📨 Request: "${message}"`);
    console.log('🎨 Treating as image generation request...');

    // Clean the message by removing common image generation verbs at the start
    let finalPrompt = message.trim();
    const imageVerbs = ['draw', 'sketch', 'create', 'visualize', 'picture', 'illustrate', 'design', 'paint', 'render', 'generate', 'make'];
    
    for (const verb of imageVerbs) {
      // Remove verb if it appears at the start of the message (case-insensitive)
      const verbPattern = new RegExp(`^${verb}\\s+`, 'i');
      if (verbPattern.test(finalPrompt)) {
        finalPrompt = finalPrompt.replace(verbPattern, '').trim();
        break; // Only remove the first matching verb
      }
    }

      console.log('🎨 Starting image generation with Gemini...');
      
      try {
        // Use Gemini's image generation (gemini-2.5-flash-image) as primary method
        // This produces better quality results than SVG generation
      const subject = finalPrompt || message.trim(); // Fallback to original if cleaning removed everything
      // For complex subjects (especially people), emphasize full body/complete subject
      const isComplexSubject = /\b(person|people|human|man|woman|figure|character|portrait|face|head|body)\b/i.test(subject);
      const completenessHint = isComplexSubject 
        ? 'complete full subject, entire figure visible from head to toe, no cropping, no cut-off, ' 
        : 'complete subject, no cropping, no cut-off, ';
      // Explicitly request consistent square dimensions
      const imagePrompt = `Clean vector line art of ${subject}, ${completenessHint}single focused subject centered on black background #000000, white lines #FFFFFF, minimalistic outline, no fill, smooth continuous lines, uniform line weight, no background elements, no environment, SVG style, professional design, no shading, high contrast, sharp edges, full composition, square format 1024x1024 pixels, high resolution, consistent sizing.`;
        
      const imageModel = process.env.IMAGE_MODEL || 'gemini-1.5-flash';
          console.log(`🎨 Generating image with ${imageModel}...`);
          
      let imgResponse;
      try {
        // Try the image generation API with responseModalities using generationConfig
        imgResponse = await client.models.generateContent({
            model: imageModel,
            contents: imagePrompt,
          generationConfig: {
              responseModalities: ['Image']
            }
          });
      } catch (apiError) {
        // Log the full error for debugging
        console.error('❌ Image generation API error (with responseModalities):', apiError);
        console.error('Error name:', apiError.name);
        console.error('Error message:', apiError.message);
        
        // Try without responseModalities as fallback
        console.log('⚠️ Trying image generation without responseModalities parameter...');
        try {
          imgResponse = await client.models.generateContent({
            model: imageModel,
            contents: imagePrompt
          });
          console.log('✅ Fallback API call succeeded');
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError.message);
          throw new Error(`Image generation API call failed: ${apiError.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }
          
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
          
          // Extract image data from parts - check all parts in case image is split
          console.log(`📦 Found ${parts.length} part(s) in response`);
          const imageParts = [];
          
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            let partData = null;
            
            if (part.inlineData && part.inlineData.data) {
              partData = part.inlineData.data;
            } else if (part.inline_data && part.inline_data.data) {
              // Alternative naming
              partData = part.inline_data.data;
            } else if (part.mimeType && part.mimeType.startsWith('image/')) {
              // Check if there's image data in other formats
              console.log(`📋 Part ${i} has mimeType: ${part.mimeType}`);
            }
            
            if (partData) {
              console.log(`📸 Found image data in part ${i}, length: ${partData.length}`);
              imageParts.push(partData);
            }
          }
          
          // Combine all image parts if multiple found (though typically there should be only one)
          if (imageParts.length === 0) {
            // Log the response structure for debugging
            console.error('No image data found. Response structure:', JSON.stringify(imgResponse, null, 2).substring(0, 2000));
            throw new Error('No image data in response');
          }
          
          // Use the largest image part (in case there are thumbnails or multiple versions)
          imageBase64 = imageParts.reduce((largest, current) => 
            current.length > largest.length ? current : largest, imageParts[0]);
          
          console.log(`📊 Using image part with length: ${imageBase64.length} (from ${imageParts.length} part(s))`);
          
          // Validate base64 string is complete (should end with valid base64 characters or padding)
          const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
          if (!base64Pattern.test(imageBase64)) {
            console.error('Invalid base64 format detected');
            throw new Error('Invalid image data format');
          }
          
          // Check if base64 string seems truncated (should be reasonably long for an image)
          // For complex images, base64 should typically be at least 10KB (roughly 13,000 chars)
          if (imageBase64.length < 100) {
            console.error('Image data seems too short:', imageBase64.length);
            throw new Error('Image data appears incomplete');
          }
          
          // Check if base64 ends properly (should end with =, ==, or valid base64 char)
          const lastChar = imageBase64[imageBase64.length - 1];
          if (!/[A-Za-z0-9+/=]/.test(lastChar)) {
            console.warn('⚠️ Base64 string may be truncated - last character is invalid');
          }
          
          console.log(`✅ Image generated, length: ${imageBase64.length}, ends with: ${imageBase64.substring(imageBase64.length - 10)}`);
          
          return res.json({
            response: "I've created an image for you! The particles will now trace its outline.",
            imageData: imageBase64,
            imageMime: 'image/png',
            isImage: true
          });
        
      } catch (imageError) {
        console.error('❌ Image generation failed:', imageError);
        console.error('Error details:', imageError.message);
      console.error('Error stack:', imageError.stack);
        return res.status(500).json({ 
          error: 'Image generation failed',
        details: imageError.message || 'Image generation was not successful. Please try again or rephrase your request.'
      });
    }

  } catch (error) {
    console.error('❌ Server error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
  console.log(`🎨 Image generation: Gemini (${process.env.IMAGE_MODEL || 'gemini-1.5-flash'})`);
  console.log(`💬 Text chat: ${process.env.CHAT_MODEL || 'gemini-1.5-flash'}`);
  console.log(`🔑 API Key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
});

// --- helpers ---
async function generateSvgOutlineWithLLM(client, userPrompt) {
  // Prefer a powerful model; allow env override
  // Use IMAGE_MODEL for SVG generation (supports nano banana model)
  const model = process.env.IMAGE_MODEL || process.env.OUTLINE_MODEL || 'gemini-1.5-flash';
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