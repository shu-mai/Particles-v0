


// Toast notification function

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Initialize Lucide (replace <i data-lucide="..."> with inline SVG)
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  
  // Auto-hide header after 10 seconds
  setTimeout(() => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      heroTitle.classList.add('exit');
    }
  }, 600);

  // Focus animation control
  const inputShell = document.querySelector('.input-shell');
  const animation = document.getElementById('animation');
  const defaultSrc = 'https://lottie.host/aafbfad5-966e-44d5-bcf2-4afc2694903c/5yGaNMxa3n.lottie';
  const focusSrc = 'https://lottie.host/e7ad424f-2ff5-402b-b19e-897280ca8495/UzKPdyU5qx.lottie';
  
  inputShell.addEventListener('focusin', () => {
    animation.setAttribute('src', focusSrc);
    animation.load();
  });
  
  inputShell.addEventListener('focusout', () => {
    animation.setAttribute('src', defaultSrc);
    animation.load();
  });

  // Cursor spotlight effect
  inputShell.addEventListener('mousemove', (e) => {
    const rect = inputShell.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    inputShell.style.setProperty('--mouse-x', `${x}%`);
    inputShell.style.setProperty('--mouse-y', `${y}%`);
  });
});

// Chat input behavior
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// Auto-grow textarea up to 200px
function autosize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
}
input.addEventListener('input', autosize);
autosize();

// Enter to send; Shift+Enter for newline
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests

// Handle send click
sendBtn.addEventListener('click', async () => {
  const text = input.value.trim();
  if (!text) return;

  // Rate limiting check
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_DELAY) {
    const heroTitle = document.querySelector('.hero-title');
    heroTitle.textContent = 'Please wait a moment before sending another message...';
    heroTitle.style.opacity = '0.7';
    setTimeout(() => {
      heroTitle.textContent = 'How was your day today?';
      heroTitle.style.opacity = '1';
    }, 2000);
    return;
  }

  // Clear input immediately
  input.value = '';
  autosize();
  lastRequestTime = now;

  // Show loading state
  const subtitleText = document.querySelector('.subtitle-text');
  
  // Create thinking message without clearing existing messages
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'message thinking';
  thinkingDiv.textContent = 'Thinking...';
  subtitleText.appendChild(thinkingDiv);
  subtitleText.classList.add('show');
  
  // Scroll to bottom to show the new "Thinking..." message
  subtitleText.scrollTop = subtitleText.scrollHeight;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: text
      })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const aiResponse = data.response;

    // Log the API response
    console.log('AI Response:', aiResponse);

    // Remove the "Thinking..." message
    const thinkingMessage = subtitleText.querySelector('.thinking');
    if (thinkingMessage) {
      thinkingMessage.remove();
    }
    
    // Add to conversation history with typewriter effect
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    subtitleText.appendChild(messageDiv);
    
    // Typewriter effect
    let i = 0;
    const typeWriter = () => {
      if (i < aiResponse.length) {
        messageDiv.textContent += aiResponse.charAt(i);
        i++;
        
        // Always auto-scroll to bottom to follow the typing
        // Try scrolling the subtitle area instead of subtitle text
        const subtitleArea = document.querySelector('.subtitle-area');
        if (subtitleArea) {
          subtitleArea.scrollTop = subtitleArea.scrollHeight;
        }
        
        setTimeout(typeWriter, 20); // Adjust speed here (lower = faster)
      }
    };
    
    typeWriter();
    
    // Debug: log current message count
    console.log('Total messages:', subtitleText.children.length);

  } catch (error) {
    showToast('There was an error. Please try again.');
    
    // Remove the "Thinking..." message
    const thinkingMessage = subtitleText.querySelector('.thinking');
    if (thinkingMessage) {
      thinkingMessage.remove();
    }
    
    subtitleText.classList.remove('show');
  }

  input.focus();
});
