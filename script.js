console.log('🔍 Script.js loaded');
console.log('🔍 Input element:', document.getElementById('chatInput'));
console.log('🔍 Send button:', document.getElementById('sendBtn'));

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
  
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  
  // Auto-hide header
  setTimeout(() => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      heroTitle.classList.add('exit');
    }
  }, 600);

  // Focus effects for input shell
  const inputShell = document.querySelector('.input-shell');
  
  inputShell.addEventListener('focusin', () => {
    if (window.SplineParticles) {
      const currentState = window.SplineParticles.getCurrentState();
      if (currentState !== 'typing' && currentState !== 'tracing') {
        window.SplineParticles.setState('focused');
      }
    }
  });
  
  inputShell.addEventListener('focusout', () => {
    if (window.SplineParticles) {
      const currentState = window.SplineParticles.getCurrentState();
      if (currentState !== 'typing' && currentState !== 'tracing') {
        window.SplineParticles.setState('unfocused');
      }
    }
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
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  if (!input || !sendBtn) {
    console.error('Chat input elements not found!');
    return;
  }

  let currentTypingAnimation = null;

  input.placeholder = "Tell me your thoughts...";

  // Auto-grow textarea
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  }

  // Update button state
  function updateButtonState() {
    const hasText = input.value.trim().length > 0;
    sendBtn.classList.toggle('enabled', hasText);
  }

  input.addEventListener('input', () => {
    autosize();
    updateButtonState();
  });

  autosize();
  updateButtonState();

  // Enter to send
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        sendBtn.click();
      }
    }
  });

  // Rate limiting
  let lastRequestTime = 0;
  const RATE_LIMIT_DELAY = 2000;

  // Handle send click
  sendBtn.addEventListener('click', async (e) => {
    const text = input.value.trim();
    if (!text) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    const now = Date.now();
    if (now - lastRequestTime < RATE_LIMIT_DELAY) {
      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle) {
        heroTitle.textContent = 'Please wait a moment...';
        heroTitle.style.opacity = '0.7';
        setTimeout(() => {
          heroTitle.textContent = 'How was your day today?';
          heroTitle.style.opacity = '1';
        }, 2000);
      } else {
        showToast('Please wait a moment...');
      }
      return;
    }

    input.value = '';
    autosize();
    updateButtonState();
    lastRequestTime = now;

    const subtitleText = document.querySelector('.subtitle-text');
    
    // Create thinking message
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message thinking';
    thinkingDiv.textContent = 'Thinking...';
    subtitleText.appendChild(thinkingDiv);
    subtitleText.classList.add('show');
    
    // Set particles to thinking state
    if (window.SplineParticles) {
      window.SplineParticles.setState('thinking');
    }
    
    subtitleText.scrollTop = subtitleText.scrollHeight;

    try {
      console.log('📤 Sending message:', text);
      
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
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API request failed:', response.status, errorData);
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();
      const aiResponse = data.response;
      
      console.log('📥 Response received');
      console.log('Is image:', data.isImage);
      
      // Handle image generation response
      if (data.isImage && data.imageData) {
        console.log('🎨 Image generation detected');
        console.log('📊 Image data length:', data.imageData.length);
        
        // Process image for particle tracing
        if (window.SplineParticles && window.SplineParticles.traceImage) {
          try {
            console.log('🎨 Starting particle tracing...');
            
            // Call tracing with image data and mime (png/svg)
            await window.SplineParticles.traceImage(data.imageData, { imageMime: data.imageMime || 'image/png' });
            
            console.log('✅ Particle tracing initiated successfully');
          } catch (error) {
            console.error('❌ Error tracing image:', error);
            console.error('Error stack:', error.stack);
            
            // Fallback to normal state if tracing fails
            if (window.SplineParticles && window.SplineParticles.setState) {
              window.SplineParticles.setState('unfocused');
            }
            
            showToast('Image tracing failed, but you can still see the response!');
          }
        } else {
          console.warn('⚠️ Tracing not available');
        }
      }

      // Remove thinking message
      const thinkingMessage = subtitleText.querySelector('.thinking');
      if (thinkingMessage) {
        thinkingMessage.remove();
      }
      
      // Return particles to appropriate state (unless tracing)
      if (window.SplineParticles && !data.isImage) {
        const input = document.getElementById('chatInput');
        if (input && document.activeElement === input) {
          window.SplineParticles.setState('focused');
        } else {
          window.SplineParticles.setState('unfocused');
        }
      }
      
      // Add to conversation history with typewriter effect
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      subtitleText.appendChild(messageDiv);
      
      // Simple markdown parser
      function parseMarkdownSafe(text) {
        const escaped = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const md = escaped
          .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
        if (window.DOMPurify) {
          return window.DOMPurify.sanitize(md, { ALLOWED_TAGS: ['h1','h2','h3','h4','strong','em','br'] });
        }
        return md;
      }
      
      // Cancel any existing typing animation
      if (currentTypingAnimation) {
        clearTimeout(currentTypingAnimation);
        currentTypingAnimation = null;
      }
      
      // Set particles to typing state (unless it's an image)
      if (window.SplineParticles && !data.isImage) {
        window.SplineParticles.setState('typing');
      }
      
      // Typewriter effect
      let i = 0;
      let currentText = '';
      let isTyping = true;
      
      const typeWriter = () => {
        if (!isTyping) return;
        
        if (i < aiResponse.length) {
          currentText += aiResponse.charAt(i);
          messageDiv.innerHTML = parseMarkdownSafe(currentText);
          i++;
          
          const subtitleArea = document.querySelector('.subtitle-area');
          if (subtitleArea) {
            subtitleArea.scrollTop = subtitleArea.scrollHeight;
          }
          
          currentTypingAnimation = setTimeout(typeWriter, 15);
        } else {
          // Typing finished
          isTyping = false;
          currentTypingAnimation = null;
          
          // Return to appropriate state (unless tracing)
          if (window.SplineParticles) {
            const currentState = window.SplineParticles.getCurrentState();
            
            if (currentState !== 'tracing') {
              const input = document.getElementById('chatInput');
              if (input && document.activeElement === input) {
                window.SplineParticles.setState('focused');
              } else {
                window.SplineParticles.setState('unfocused');
              }
            }
          }
        }
      };
      
      typeWriter();
      
      console.log('Total messages:', subtitleText.children.length);

    } catch (error) {
      console.error('❌ Request error:', error);
      showToast('There was an error. Please try again.');
      
      const thinkingMessage = subtitleText.querySelector('.thinking');
      if (thinkingMessage) {
        thinkingMessage.remove();
      }
      
      // Return particles to appropriate state on error
      if (window.SplineParticles) {
        const input = document.getElementById('chatInput');
        if (input && document.activeElement === input) {
          window.SplineParticles.setState('focused');
        } else {
          window.SplineParticles.setState('unfocused');
        }
      }
      
      subtitleText.classList.remove('show');
    }

    input.focus();
  });

});