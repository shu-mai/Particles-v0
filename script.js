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

  // Truncated nav text tooltip functionality
  const navTexts = document.querySelectorAll('.nav-text');
  let tooltipElement = null;
  let tooltipTimeout = null;
  const TOOLTIP_DELAY = 600; // 600ms delay before showing tooltip
  let lastMouseX = 0;
  let lastMouseY = 0;

  navTexts.forEach(navText => {
    navText.addEventListener('mouseenter', (e) => {
      // Check if text is truncated
      if (navText.scrollWidth > navText.clientWidth) {
        // Track cursor position
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Clear any existing timeout
        if (tooltipTimeout) clearTimeout(tooltipTimeout);

        // Update mouse position on mousemove
        const moveHandler = (moveEvent) => {
          lastMouseX = moveEvent.clientX;
          lastMouseY = moveEvent.clientY;
        };

        navText.addEventListener('mousemove', moveHandler);
        navText._tooltipMoveHandler = moveHandler;

        // Set timeout for showing tooltip
        tooltipTimeout = setTimeout(() => {
          // Create or reuse tooltip element
          if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'nav-text-tooltip';
            document.body.appendChild(tooltipElement);
          }

          // Set tooltip content
          tooltipElement.textContent = navText.textContent;

          // Position tooltip at last known cursor position with offset
          tooltipElement.style.left = (lastMouseX +8) + 'px';
          tooltipElement.style.top = (lastMouseY +36) + 'px';

          // Show tooltip
          tooltipElement.classList.add('visible');
        }, TOOLTIP_DELAY);
      }
    });

    navText.addEventListener('mouseleave', () => {
      // Clear timeout if tooltip hasn't shown yet
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }

      // Hide tooltip
      if (tooltipElement) {
        tooltipElement.classList.remove('visible');
      }

      // Remove mousemove handler
      if (navText._tooltipMoveHandler) {
        navText.removeEventListener('mousemove', navText._tooltipMoveHandler);
        delete navText._tooltipMoveHandler;
      }
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
  const sidebarToggleTooltip = document.getElementById('sidebarToggleTooltip');
  const avatarTooltip = document.getElementById('avatarTooltip');

  function updateTooltips() {
    const isSidebarOpen = document.body.classList.contains('sidebar-open');
    if (sidebarToggleTooltip) {
      sidebarToggleTooltip.textContent = isSidebarOpen ? 'Close sidebar' : 'Open sidebar';
    }
    if (avatarTooltip) {
      avatarTooltip.textContent = isSidebarOpen ? 'Close sidebar' : 'Open sidebar';
    }
  }

  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    updateTooltips();
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
      updateTooltips();
    });
  }

  if (avatar) {
    avatar.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) {
        document.body.classList.remove('sidebar-open');
        updateTooltips();
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

  // Page navigation for child tabs
  const childTabs = document.querySelectorAll('.nav-child-tab');
  const pageContainer = document.getElementById('pageContainer');
  const pageHeader = document.getElementById('pageHeader');
  const pageContent = document.getElementById('pageContent');
  const contentArea = document.querySelector('.content');

  // Page data mapping
  const pageData = {
    'improving-prompt-experiences': {
      header: 'Improving Prompt Experiences',
      subheader: 'Auto generating effects from daily trends',
      content: `

      <!-- TABLE -->
        <div class="table">

        <!-- TABLE HEADERS-->
          <div class="table-headers">
            <!--
            <div class="table-header">
              <i class="ph ph-spinner table-header-icon"></i>
              <span class="overline-1">Stage</span>
            </div>
            -->
            <div class="table-header">
              <i class="ph ph-calendar table-header-icon"></i>
              <span class="overline-1">Timeline</span>
            </div>
            <div class="table-header">
              <i class="ph ph-map-pin table-header-icon"></i>
              <span class="overline-1">Location</span>
            </div>
            <div class="table-header">
              <i class="ph ph-palette table-header-icon"></i>
              <span class="overline-1">Designer</span>
            </div>
            <div class="table-header">
              <i class="ph ph-user table-header-icon"></i>
              <span class="overline-1">PM</span>
            </div>
          </div>

        <!-- TABLE CELLS-->
          <div class="table-cells">
            <!--
            <div class="table-cell">
              <div class="badge" style="background: #78350F;">
                <i class="ph ph-circle-notch badge-icon" style="color: #F59E0B;"></i>
                <span class="body-1">Early</span>
              </div>
            </div>
            -->
            <div class="table-cell">
              <span class="body-2">Aug 21 - Aug 28 (1 week)</span>
            </div>
            <div class="table-cell">
              <span class="body-2">San Jose, CA</span>
            </div>
            <div class="table-cell">
              <span class="body-2">Michelle Xu</span>
            </div>
            <div class="table-cell">
              <span class="body-2">Lesliee Liu</span>
            </div>
          </div>
        </div>

      <!-- CALLOUT-1 -->
        <div class="callout-1">
          <div class="callout-1-icon-container">
            <i class="ph ph-star callout-icon"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">TLDR</span>
              <span class="body-2">This project aims to redesign the AIGE prompt experience so users can easily discover Effect Types, engage with trend-driven suggestions, and write effective prompts, while reducing drop-off and ensuring the system scales as skills grow.</span>
          </div>
        </div>

      <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Intro</span>
        </div>

      <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">1 | What do users want?</div>
          <div class="page-content-text-body">
          <span class="body-2">1. Help with discovering Effect Types easier.</span>
          <span class="body-2">2. Trend-driven suggestions to increase engagement.</span>
          <span class="body-2">3. Help with writing more effective prompts.</span>
          </div>
          </div>

      <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">2 | Problem</div>
          <div class="page-content-text-body">
          <span class="body-2">However, most users don't understand how trendy topics connect to prompt creation. The interaction between both dropdowns in the prompt box adds ambiguity and restricts freetype, creating friction in the core experience.</span>
          <br>
          <span class="body-2">Moreover, the Effect Type dropdown (30 items) and Trendy Topics Dropdown (20 items) are overloaded and lack context.</span>
          </div>
          </div>

      <!-- PAGE-CONTENT-TEXT -->
          <div class="page-content-text">
        <div class="page-content-text-title heading-2">3 | Scalabilty</div>
          <div class="page-content-text-body">
          <span class="body-2">Ultimately, our goal is to reduce the 30% drop-off from launching AIGE to submitting a message. As AIGE skills grow, a dropdown will not provide enough context or support the increasing number of Effect Types, which risks stagnating or even increasing the drop-off rate.</span>
          <br>
          <span class="body-2">Therefore, we need to...</span>
          <span class="body-2">1. Clarify interaction so LLM-powered features can scale.</span>
          <span class="body-2">2. Future-proof the system as the "Effect Types" list grows, avoiding dropdown overload.</span>
          </div>
          </div>

      <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Key solutions</span>
        </div>

      <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Results</span>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-x-circle callout-icon" style="color: #DC2626;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Tying the "Trend Topics" and "Effect Type" dropdowns together creates confusion and a forced connection.</span>
          </div>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-check-circle callout-icon" style="color: #16A34A;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Separate Effect Types from Trend Topics.</span>
              <br>
              <span class="body-2">Effect Types should be browsable, with default prompts applied as placeholder text to guide and educate users.</span>
              <br>
              <span class="body-2">Suggestive prompts appear when the user clicks into the text box to type, and only show when relevant to the chosen Effect Type.</span>
          </div>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-x-circle callout-icon" style="color: #DC2626;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Trendy Topics dropdowns are overloaded and abstract.</span>
          </div>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-check-circle callout-icon" style="color: #16A34A;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Trendy Topics appear as inline prompt suggestions using simple language; headline the first 5 or less trends.</span>
          </div>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-x-circle callout-icon" style="color: #DC2626;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Freetyping feels restricted.</span>
          </div>
        </div>

      <!-- CALLOUT -->
        <div class="callout">
          <div class="callout-icon-container">
            <i class="ph ph-check-circle callout-icon" style="color: #16A34A;"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">Provide sample prompts progressively. Suggestions should guide users in writing effective prompts without enforcing them, so the main task remains focused on freetyping.</span>
          </div>
        </div>

      <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Detailed design decisions</span>
        </div>
      `
    },

    'ai-generated-effects-web-mvp-exploration': {
      header: 'AI-Generated Effects Web MVP Exploration',
      subheader: 'Turning legacy tooling into web chat workflows',
      content: `
      <!-- TABLE -->
        <div class="table">

        <!-- TABLE HEADERS-->
          <div class="table-headers">
            <div class="table-header">
              <i class="ph ph-calendar table-header-icon"></i>
              <span class="overline-1">Timeline</span>
            </div>
            <div class="table-header">
              <i class="ph ph-map-pin table-header-icon"></i>
              <span class="overline-1">Location</span>
            </div>
            <div class="table-header">
              <i class="ph ph-palette table-header-icon"></i>
              <span class="overline-1">Designers</span>
            </div>
            <div class="table-header">
              <i class="ph ph-user table-header-icon"></i>
              <span class="overline-1">Design Lead</span>
            </div>
          </div>

        <!-- TABLE CELLS-->
          <div class="table-cells">
            <div class="table-cell">
              <span class="body-2">July 28 - Aug 1 (1 week)</span>
            </div>
            <div class="table-cell">
              <span class="body-2">San Jose, CA</span>
            </div>
            <div class="table-cell">
              <span class="body-2">Michelle Xu, Zuki Zhang</span>
            </div>
            <div class="table-cell">
              <span class="body-2">Zijian Zhang</span>
            </div>
          </div>
        </div>

        <!-- CALLOUT-1 -->
        <div class="callout-1">
          <div class="callout-1-icon-container">
            <i class="ph ph-star callout-icon"></i>
          </div>
          <div class="callout-text">
              <span class="body-2">TLDR</span>
              <span class="body-2">Build an AI-powered, lightweight Effect House to reduce the steep learning curve.</span>
          </div>
        </div>

        <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Background</span>
        </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
          <div class="page-content-text-body">
          <span class="body-2">In collaboration with R&D, we’ve validated early feasibility through a concept called Design-in-Loop.</span>
          </div>
          </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">1 | Design goal</div>
          <div class="page-content-text-body">
          <span class="body-2">Context-aware chat that combines editing and workspace flexibility.</span>
          </div>
          </div>
        
        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">1 | Value</div>
          <div class="page-content-text-body">
          <span class="body-2">Creators gravitate toward repeatable, visual effects (beauty, green screen, filters, etc).</span>
          </div>
          </div>
        
        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
          <div class="page-content-text-body">
          <span class="body-2">Opportunity: Enhance T2I workflows with AI assistance → drives higher conversion.</span>
          </div>
          </div>

        <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">Creation flow</span>
        </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">1 | Ideation</div>
          <div class="page-content-text-body">
          <span class="body-2">Generate assets (T2I, I2I), pull from references, and use templates to spark ideas and build prompts.</span>
          </div>
          </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">2 | Editing</div>
          <div class="page-content-text-body">
          <span class="body-2">Refine and evolve creations directly through the chat, making it the centralized point for editing.</span>
          </div>
          </div>

        <!-- PAGE-BREAK -->
        <div class="page-break">
          <span class="heading-2">User flow</span>
        </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">Users with a clear idea</div>
          </div>
          </div>

        <!-- PAGE-CONTENT-TEXT -->
        <div class="page-content-text">
        <div class="page-content-text-title heading-2">Users not sure what to create</div>
          </div>
          </div>
      `
    },

    '2d-3d-editor-integration': {
      header: '2D/3D Editor Integration',
      content: ''
    },
    'effect-house-ax-research': {
      header: 'Effect House AX Research',
      content: ''
    }
  };

  // Function to navigate to a page
  function navigateToPage(pageId) {
    const page = pageData[pageId];
    const tab = document.querySelector(`[data-page="${pageId}"]`);

    if (page) {
      // Update page header and content
      let headerHTML = `<span class="heading-1">${page.header}</span>`;
      if (page.subheader) {
        headerHTML += `<span class="subheading-1">${page.subheader}</span>`;
      }
      pageHeader.innerHTML = headerHTML;
      pageContent.innerHTML = page.content;

      // Show page container and hide hero/input
      pageContainer.classList.add('active');
      contentArea.classList.add('page-open');

      // Update active tab
      childTabs.forEach(t => t.classList.remove('active'));
      if (tab) tab.classList.add('active');

      // Update URL hash
      window.location.hash = pageId;
    }
  }

  // Function to go to home
  function navigateToHome() {
    pageContainer.classList.remove('active');
    contentArea.classList.remove('page-open');
    childTabs.forEach(t => t.classList.remove('active'));
    
    // Clear URL hash
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }

  // Handle child tab clicks
  childTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const pageId = tab.getAttribute('data-page');
      navigateToPage(pageId);
    });
  });

  // Home button closes page view
  const homeTab = document.querySelector('[data-tab="house"]');
  if (homeTab) {
    homeTab.addEventListener('click', navigateToHome);
  }

  // On page load, check if there's a hash in the URL and navigate to that page
  const initialHash = window.location.hash.slice(1); // Remove the '#'
  if (initialHash && pageData[initialHash]) {
    navigateToPage(initialHash);
  }

  // Handle browser back/forward buttons
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash && pageData[hash]) {
      navigateToPage(hash);
    } else {
      navigateToHome();
    }
  });
});