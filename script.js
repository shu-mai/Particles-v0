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

  let placeholderText = "Try \"create a cat eating icecream.\"";
  let hasSentFirstMessage = false;
  input.placeholder = ""; // Clear placeholder, we'll use overlay instead

  // Create shimmer overlay for placeholder
  const shimmerOverlay = document.createElement('div');
  shimmerOverlay.className = 'shimmer-placeholder';
  shimmerOverlay.textContent = placeholderText;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(shimmerOverlay);

  // Make shimmer responsive to text width and position it correctly
  function updateShimmerSize() {
    // Get the computed font family from the input element to ensure accurate measurement
    const inputStyles = window.getComputedStyle(input);
    const fontFamily = inputStyles.fontFamily;
    
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.fontSize = '16px';
    tempSpan.style.fontWeight = '400';
    tempSpan.style.fontFamily = fontFamily;
    tempSpan.style.whiteSpace = 'pre-wrap';
    tempSpan.textContent = shimmerOverlay.textContent;
    document.body.appendChild(tempSpan);
    
    const textWidth = tempSpan.offsetWidth;
    const textHeight = tempSpan.offsetHeight;
    document.body.removeChild(tempSpan);
    
    // Adjust background-size to be responsive to text width
    // Make it slightly wider than the text so the shimmer can sweep across
    const backgroundSize = Math.max(textWidth * 1.5, 200); // At least 1.5x text width, minimum 200px
    shimmerOverlay.style.setProperty('--shimmer-width', `${backgroundSize}px`);
    shimmerOverlay.style.backgroundSize = `${backgroundSize}px 100%`;
    
    // Position shimmer to match textarea position (accounting for button)
    const sendContainer = document.querySelector('.send-container');
    const sendContainerWidth = sendContainer ? sendContainer.offsetWidth : 80;
    const gap = 12; // Match the gap in CSS
    const inputShell = input.parentElement;
    const isWrapped = inputShell.classList.contains('wrapped');
    
    shimmerOverlay.style.left = '16px';
    if (isWrapped) {
      // When wrapped, button is below, so shimmer can use full width
      shimmerOverlay.style.right = '16px';
    } else {
      // When on same row, account for button width
      shimmerOverlay.style.right = `${sendContainerWidth + gap + 16}px`;
    }
    shimmerOverlay.style.top = '50%';
    shimmerOverlay.style.transform = 'translateY(-50%)';
  }

  // Update shimmer size when text changes or window resizes
  updateShimmerSize();
  window.addEventListener('resize', updateShimmerSize);

  // Show/hide shimmer based on input state
  function updateShimmer() {
    if (input.value.trim().length === 0) {
      shimmerOverlay.style.display = 'block';
      updateShimmerSize(); // Recalculate on show
    } else {
      shimmerOverlay.style.display = 'none';
    }
  }

  input.addEventListener('input', updateShimmer);
  input.addEventListener('blur', updateShimmer);
  updateShimmer(); // Initial state

  // Auto-grow textarea to fit content and switch layout
  function autosize() {
    const containerMaxHeight = 229; // Container max-height
    const containerPadding = 32; // 16px top + 16px bottom
    const buttonHeight = 32; // Button height
    const buttonMargin = 8; // Margin when wrapped
    const oneLineHeight = 24; // One line: 16px font * 1.5 line-height
    const inputShell = input.parentElement;
    const isEmpty = input.value.trim().length === 0;
    
    // If empty, force reset to one line
    if (isEmpty) {
      input.style.height = oneLineHeight + 'px';
      inputShell.classList.remove('wrapped');
      inputShell.style.flexDirection = 'row';
      inputShell.style.alignItems = 'center';
      inputShell.style.height = 'auto'; // Reset container height
      input.style.overflowY = 'hidden';
      
      // Update shimmer positioning
      if (typeof updateShimmerSize === 'function') {
        updateShimmerSize();
      }
      return;
    }
    
    // Reset height to one line first to get accurate scrollHeight
    input.style.height = '24px';
    const scrollHeight = input.scrollHeight;
    
    // Calculate max height for textarea based on container max-height
    // When wrapped: container max (229) - padding (32) - button height (32) - button margin (8) = 157px
    // When not wrapped: container max (229) - padding (32) = 197px (but button is on same row, so use 197px)
    const hasWrapped = scrollHeight > oneLineHeight;
    const maxTextareaHeight = hasWrapped 
      ? containerMaxHeight - containerPadding - buttonHeight - buttonMargin
      : containerMaxHeight - containerPadding;
    
    // Calculate new height
    let newHeight;
    if (hasWrapped) {
      // Text has wrapped, use scrollHeight but respect max
      newHeight = Math.min(scrollHeight, maxTextareaHeight);
    } else {
      // Text fits in one line, keep it at one line
      newHeight = oneLineHeight;
    }
    
    input.style.height = newHeight + 'px';
    
    // Switch layout: row when one line, column when wrapped
    if (hasWrapped) {
      inputShell.classList.add('wrapped');
      inputShell.style.flexDirection = 'column';
      inputShell.style.alignItems = 'stretch'; // Stretch children to full width (textarea will be full width)
    } else {
      inputShell.classList.remove('wrapped');
      inputShell.style.flexDirection = 'row';
      inputShell.style.alignItems = 'center'; // Center align when on same row
    }
    
    // Update shimmer positioning when layout changes
    if (typeof updateShimmerSize === 'function') {
      updateShimmerSize();
    }
    
    // Update textarea overflow if needed
    if (scrollHeight > maxTextareaHeight) {
      input.style.overflowY = 'auto';
    } else {
      input.style.overflowY = 'hidden';
    }
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

  // Initial autosize to set correct starting height
  autosize();
  
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

    // Update placeholder text after first message
    if (!hasSentFirstMessage) {
      hasSentFirstMessage = true;
      placeholderText = "Create anything";
      shimmerOverlay.textContent = placeholderText;
      
      // Remove shimmer effect and set to solid zinc-500 color
      shimmerOverlay.style.animation = 'none';
      shimmerOverlay.style.background = 'none';
      shimmerOverlay.style.color = 'var(--color-zinc-700)';
      shimmerOverlay.style.webkitTextFillColor = 'var(--color-zinc-700)';
      shimmerOverlay.style.backgroundClip = 'unset';
      shimmerOverlay.style.webkitBackgroundClip = 'unset';
      
      updateShimmerSize(); // Recalculate shimmer size for new text
    }

    // Stop any ongoing trace and set particles to thinking state
    if (window.SplineParticles) {
      // Stop any ongoing trace animation
      if (window.SplineParticles.stopTracing) {
        window.SplineParticles.stopTracing();
      }
      // Set to thinking state for the new request
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


  // Navigation tabs state management
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      navTabs.forEach(t => t.classList.remove('active'));

      // Add active class to clicked tab
      tab.classList.add('active');

      // Get the tab name for potential content switching
      const tabName = tab.getAttribute('data-tab');
      console.log(`Switched to tab: ${tabName}`);
    });
  });

  // Modal close functionality
  const modal = document.getElementById('mainModal');
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  // Mobile sidebar toggle functionality
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebarOverlay = document.querySelector('.sidebar-overlay');
  const avatar = document.querySelector('.avatar');

  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });
  }

  if (avatar) {
    avatar.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) {
        document.body.classList.remove('sidebar-open');
      }
    });
  }

  // Locked Project Modal functionality
  const lockedProjectModal = document.getElementById('lockedProjectModal');
  const tiktokTab = document.querySelector('[data-tab="tiktok-logo"]');
  const optoTab = document.querySelector('[data-tab="opto"]');
  const cancelBtn = document.querySelector('.btn-cancel');
  const continueBtn = document.querySelector('.btn-continue');
  const overlay = document.querySelector('.locked-project-overlay');
  const passwordInput = document.querySelector('.password-input');

  // Open modal when clicking locked tabs
  if (tiktokTab) {
    tiktokTab.addEventListener('click', (e) => {
      e.preventDefault();
      lockedProjectModal.classList.add('active');
    });
  }

  if (optoTab) {
    optoTab.addEventListener('click', (e) => {
      e.preventDefault();
      lockedProjectModal.classList.add('active');
    });
  }

  // Close modal when clicking cancel
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      lockedProjectModal.classList.remove('active');
      passwordInput.value = '';
    });
  }

  // Close modal when clicking overlay
  if (overlay) {
    overlay.addEventListener('click', () => {
      lockedProjectModal.classList.remove('active');
      passwordInput.value = '';
    });
  }

  // Continue button logic
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      // Add your password validation logic here
      console.log('Continue clicked with password:', passwordInput.value);
      // For now, just close the modal
      lockedProjectModal.classList.remove('active');
      passwordInput.value = '';
    });
  }
});