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

  // Typing detection for particle glow effect
  let typingTimeout = null;
  const TYPING_TIMEOUT = 500; // 500ms after last keystroke

  function handleTyping() {
    // Set particles to typing state
    if (window.SplineParticles && window.SplineParticles.setUserTyping) {
      window.SplineParticles.setUserTyping(true);
    }
    
    // Update character count for particle emission scaling
    const charCount = input.value.length;
    if (window.SplineParticles && window.SplineParticles.setCharacterCount) {
      window.SplineParticles.setCharacterCount(charCount);
    }
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set timeout to detect when typing stops
    typingTimeout = setTimeout(() => {
      if (window.SplineParticles && window.SplineParticles.setUserTyping) {
        window.SplineParticles.setUserTyping(false);
      }
      // Reset character count when typing stops
      if (window.SplineParticles && window.SplineParticles.setCharacterCount) {
        window.SplineParticles.setCharacterCount(0);
      }
    }, TYPING_TIMEOUT);
  }

  input.addEventListener('input', () => {
    autosize();
    updateButtonState();
    handleTyping();
  });

  // Combined keydown handler for typing detection and Enter to send
  input.addEventListener('keydown', (e) => {
    // Enter to send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        // Stop typing glow when sending
        if (window.SplineParticles && window.SplineParticles.setUserTyping) {
          window.SplineParticles.setUserTyping(false);
        }
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        sendBtn.click();
      }
    } else {
      // Detect typing for glow effect (all other keys)
      handleTyping();
    }
  });

  // Stop typing glow when input loses focus
  input.addEventListener('blur', () => {
    if (window.SplineParticles && window.SplineParticles.setUserTyping) {
      window.SplineParticles.setUserTyping(false);
    }
    if (window.SplineParticles && window.SplineParticles.setCharacterCount) {
      window.SplineParticles.setCharacterCount(0);
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
  });

  autosize();
  updateButtonState();

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

    // Set particles to thinking state
    if (window.SplineParticles) {
      window.SplineParticles.setState('thinking');
    }

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
      } else {
        // Return particles to appropriate state for non-image responses
        if (window.SplineParticles) {
          const input = document.getElementById('chatInput');
          if (input && document.activeElement === input) {
            window.SplineParticles.setState('focused');
          } else {
            window.SplineParticles.setState('unfocused');
          }
        }
      }

    } catch (error) {
      console.error('❌ Request error:', error);
      showToast('There was an error. Please try again.');
      
      // Return particles to appropriate state on error
      if (window.SplineParticles) {
        const input = document.getElementById('chatInput');
        if (input && document.activeElement === input) {
          window.SplineParticles.setState('focused');
        } else {
          window.SplineParticles.setState('unfocused');
        }
      }
    }

    input.focus();
  });

});