/**
 * ELARA BROWSER EXTENSION - CONTENT SCRIPT
 *
 * Behavioral Biometrics Anti-Scam System
 *
 * Monitors page behavior in real-time to detect scam tactics:
 * - Fake countdown timers
 * - Clipboard hijacking
 * - Forced redirects
 * - Hidden form fields
 * - Aggressive popups
 * - Auto-submit/download/redirect
 *
 * FREE ENTERPRISE-GRADE SOLUTION:
 * Pure JavaScript, no external dependencies
 * Runs entirely in the browser (privacy-first)
 */

console.log('🛡️ Elara Anti-Scam Guardian activated');

// Behavior monitoring state
const behaviorData = {
  countdownTimers: {
    detected: false,
    count: 0,
    isFake: false,
    elements: [],
  },
  redirects: {
    count: 0,
    chain: [],
    suspicious: false,
  },
  clipboardAccess: {
    attempted: false,
    modified: false,
    original: '',
    replaced: '',
  },
  hiddenFields: {
    count: 0,
    names: [],
  },
  popups: {
    count: 0,
    timing: [],
    exitIntent: false,
  },
  autoActions: {
    autoSubmit: false,
    autoDownload: false,
    autoRedirect: false,
  },
};

// Page load timestamp
const pageLoadTime = Date.now();

/**
 * 1. DETECT FAKE COUNTDOWN TIMERS
 */
function detectCountdownTimers() {
  const timerSelectors = [
    '[id*="countdown"]',
    '[class*="countdown"]',
    '[id*="timer"]',
    '[class*="timer"]',
    '[class*="urgency"]',
    '[id*="expires"]',
  ];

  timerSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      const text = element.textContent || '';

      // Check if it looks like a timer (contains numbers and time indicators)
      const hasTimePattern = /\d+\s*(day|hour|min|sec|hr|m|s)/i.test(text);
      if (hasTimePattern) {
        behaviorData.countdownTimers.detected = true;
        behaviorData.countdownTimers.count++;
        behaviorData.countdownTimers.elements.push({
          selector: selector,
          text: text.trim().substring(0, 100),
        });

        // Store initial value to check if it's fake (resets on refresh)
        const initialValue = text;
        const timerKey = `elara_timer_${window.location.href}_${selector}`;

        // Check if we've seen this timer before
        const previousValue = sessionStorage.getItem(timerKey);
        if (previousValue && previousValue === initialValue) {
          behaviorData.countdownTimers.isFake = true;
          console.warn('⚠️ SCAM DETECTED: Fake countdown timer (resets on refresh)');
        }

        // Store current value
        sessionStorage.setItem(timerKey, initialValue);
      }
    });
  });
}

/**
 * 2. DETECT REDIRECT CHAINS
 */
function monitorRedirects() {
  // Track page navigation
  let redirectCount = 0;
  const maxRedirects = 3;

  // Monitor history API usage
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    redirectCount++;
    behaviorData.redirects.count = redirectCount;
    behaviorData.redirects.chain.push(window.location.href);

    if (redirectCount >= maxRedirects) {
      behaviorData.redirects.suspicious = true;
      console.warn(`⚠️ SCAM DETECTED: Multiple redirects (${redirectCount})`);
    }

    return originalPushState.apply(this, args);
  };

  history.replaceState = function (...args) {
    redirectCount++;
    behaviorData.redirects.count = redirectCount;
    return originalReplaceState.apply(this, args);
  };

  // Detect meta refresh redirects
  const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  if (metaRefresh) {
    redirectCount++;
    behaviorData.redirects.count = redirectCount;
    console.warn('⚠️ Detected meta refresh redirect');
  }
}

/**
 * 3. DETECT CLIPBOARD HIJACKING
 */
function monitorClipboard() {
  // Monitor copy events
  document.addEventListener('copy', (e) => {
    behaviorData.clipboardAccess.attempted = true;
    console.log('📋 Clipboard access detected');
  });

  // Monitor paste events
  document.addEventListener('paste', (e) => {
    behaviorData.clipboardAccess.attempted = true;
  });

  // Detect clipboard API usage
  const originalWriteText = navigator.clipboard?.writeText;
  if (originalWriteText) {
    navigator.clipboard.writeText = async function (text) {
      behaviorData.clipboardAccess.attempted = true;
      behaviorData.clipboardAccess.modified = true;
      behaviorData.clipboardAccess.replaced = text.substring(0, 100);

      console.warn('⚠️ SCAM DETECTED: Page is modifying clipboard!');
      console.warn('Attempted to write:', text.substring(0, 100));

      // Block crypto address replacement (common scam)
      if (/^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/.test(text)) {
        console.error('🚨 BLOCKED: Cryptocurrency address clipboard hijack attempt!');
        alert('⚠️ ELARA SECURITY ALERT\n\nThis website tried to replace your clipboard with a cryptocurrency address!\n\nThis is a common scam tactic. DO NOT proceed with any transactions on this site.');
        return; // Block the clipboard modification
      }

      return originalWriteText.apply(this, [text]);
    };
  }
}

/**
 * 4. DETECT HIDDEN FORM FIELDS
 */
function detectHiddenFields() {
  const forms = document.querySelectorAll('form');

  forms.forEach((form) => {
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const sensitivePatterns = [
      'card',
      'cvv',
      'ccv',
      'credit',
      'ssn',
      'social',
      'password',
      'pin',
      'account',
      'routing',
    ];

    hiddenInputs.forEach((input) => {
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();

      sensitivePatterns.forEach((pattern) => {
        if (name.includes(pattern) || id.includes(pattern)) {
          behaviorData.hiddenFields.count++;
          behaviorData.hiddenFields.names.push(input.name || input.id);
          console.warn(`⚠️ SCAM DETECTED: Hidden field for sensitive data: ${input.name || input.id}`);
        }
      });
    });
  });
}

/**
 * 5. DETECT AGGRESSIVE POPUPS
 */
function monitorPopups() {
  let popupCount = 0;

  // Monitor window.open
  const originalOpen = window.open;
  window.open = function (...args) {
    popupCount++;
    const timeSinceLoad = Date.now() - pageLoadTime;

    behaviorData.popups.count = popupCount;
    behaviorData.popups.timing.push(timeSinceLoad);

    if (popupCount >= 3) {
      console.warn(`⚠️ SCAM DETECTED: Multiple popups (${popupCount})`);
    }

    // Detect rapid-fire popups (3+ in 5 seconds)
    if (behaviorData.popups.timing.filter(t => t < 5000).length >= 3) {
      console.error('🚨 SCAM DETECTED: Rapid-fire popup spam!');
      alert('⚠️ ELARA SECURITY ALERT\n\nThis website is using aggressive popup tactics!\n\nThis is a red flag for scam websites. Consider leaving this site.');
      return null; // Block the popup
    }

    return originalOpen.apply(this, args);
  };

  // Detect exit-intent popups
  document.addEventListener('mouseleave', (e) => {
    if (e.clientY < 0) {
      behaviorData.popups.exitIntent = true;
      console.log('📌 Exit-intent popup trigger detected');
    }
  });
}

/**
 * 6. DETECT AUTO-ACTIONS
 */
function detectAutoActions() {
  // Monitor for auto-submit
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    // Check if form has auto-submit script
    const onload = form.getAttribute('onload');
    const onsubmit = form.getAttribute('onsubmit');

    if (onload && onload.includes('submit')) {
      behaviorData.autoActions.autoSubmit = true;
      console.warn('⚠️ SCAM DETECTED: Auto-submit form');
    }
  });

  // Monitor for auto-download
  const autoDownloadLinks = document.querySelectorAll('a[download]');
  if (autoDownloadLinks.length > 0) {
    autoDownloadLinks.forEach((link) => {
      // Check if it's triggered automatically
      if (link.hasAttribute('autoclick')) {
        behaviorData.autoActions.autoDownload = true;
        console.warn('⚠️ SCAM DETECTED: Auto-download detected');
      }
    });
  }

  // Monitor for auto-redirect via JavaScript
  const scripts = document.querySelectorAll('script');
  scripts.forEach((script) => {
    const content = script.textContent || '';
    if (
      content.includes('window.location') &&
      (content.includes('setTimeout') || content.includes('setInterval'))
    ) {
      behaviorData.autoActions.autoRedirect = true;
      console.log('📍 Auto-redirect script detected');
    }
  });
}

/**
 * 7. SEND BEHAVIOR REPORT TO BACKEND
 */
async function reportBehavior() {
  try {
    // Get Elara backend URL from storage
    const { backendUrl, authToken } = await chrome.storage.sync.get(['backendUrl', 'authToken']);

    if (!backendUrl || !authToken) {
      console.log('ℹ️ Elara backend not configured, skipping behavior report');
      return;
    }

    // Calculate risk score
    const riskScore = calculateRiskScore(behaviorData);

    // Send report to backend
    const response = await fetch(`${backendUrl}/api/v2/behavior/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        url: window.location.href,
        behaviors: behaviorData,
        riskScore,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });

    if (response.ok) {
      console.log('✅ Behavior report sent to Elara');
    }
  } catch (error) {
    console.error('Failed to send behavior report:', error);
  }
}

/**
 * Calculate risk score based on detected behaviors
 */
function calculateRiskScore(data) {
  let score = 0;

  if (data.countdownTimers.isFake) score += 15;
  if (data.clipboardAccess.modified) score += 20;
  if (data.redirects.count >= 3) score += 12;
  if (data.hiddenFields.count > 0) score += 10;
  if (data.popups.exitIntent) score += 8;
  if (data.popups.count >= 3) score += 10;
  if (data.autoActions.autoSubmit) score += 15;
  if (data.autoActions.autoDownload) score += 12;

  return Math.min(score, 40); // Max 40 points
}

/**
 * Display real-time warning if high risk
 */
function displayWarningIfNeeded() {
  const riskScore = calculateRiskScore(behaviorData);

  if (riskScore >= 30) {
    // High risk - show prominent warning
    showElaraWarning('CRITICAL', riskScore);
  } else if (riskScore >= 15) {
    // Medium risk - show moderate warning
    showElaraWarning('WARNING', riskScore);
  }
}

/**
 * Show Elara security warning overlay
 */
function showElaraWarning(level, score) {
  // Create warning overlay
  const overlay = document.createElement('div');
  overlay.id = 'elara-security-warning';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: ${level === 'CRITICAL' ? '#dc2626' : '#f59e0b'};
    color: white;
    padding: 16px;
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;

  overlay.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
      <div style="flex: 1;">
        <strong style="font-size: 16px;">
          ${level === 'CRITICAL' ? '🚨 ELARA CRITICAL ALERT' : '⚠️ ELARA SECURITY WARNING'}
        </strong>
        <div style="margin-top: 4px;">
          Suspicious behavior detected on this page (Risk Score: ${score}/40)
          ${behaviorData.countdownTimers.isFake ? ' • Fake countdown timer' : ''}
          ${behaviorData.clipboardAccess.modified ? ' • Clipboard hijacking' : ''}
          ${behaviorData.redirects.suspicious ? ' • Multiple redirects' : ''}
        </div>
      </div>
      <button id="elara-dismiss" style="background: white; color: #1f2937; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-left: 16px;">
        Dismiss
      </button>
    </div>
  `;

  document.body.insertBefore(overlay, document.body.firstChild);

  // Dismiss button
  document.getElementById('elara-dismiss')?.addEventListener('click', () => {
    overlay.remove();
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    overlay.remove();
  }, 10000);
}

/**
 * INITIALIZE MONITORING
 */
function initializeMonitoring() {
  // Run initial detection
  detectCountdownTimers();
  detectHiddenFields();
  detectAutoActions();

  // Set up continuous monitoring
  monitorRedirects();
  monitorClipboard();
  monitorPopups();

  // Re-scan on DOM changes
  const observer = new MutationObserver(() => {
    detectCountdownTimers();
    detectHiddenFields();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Report behavior after 5 seconds
  setTimeout(() => {
    displayWarningIfNeeded();
    reportBehavior();
  }, 5000);

  console.log('✅ Elara behavioral monitoring initialized');
}

// Start monitoring when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMonitoring);
} else {
  initializeMonitoring();
}

// Send behavior data to popup when requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBehaviorData') {
    sendResponse({
      behaviorData,
      riskScore: calculateRiskScore(behaviorData),
    });
  }
});
