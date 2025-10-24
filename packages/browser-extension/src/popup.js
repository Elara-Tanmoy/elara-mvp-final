/**
 * ELARA BROWSER EXTENSION - POPUP SCRIPT
 * Displays current page security status
 */

// Get behavior data from content script
async function getCurrentPageBehavior() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tab.id,
      { action: 'getBehaviorData' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting behavior data:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Display results
async function displayResults() {
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const riskBadge = document.getElementById('riskBadge');
  const behaviorList = document.getElementById('behaviorList');

  try {
    const data = await getCurrentPageBehavior();

    if (!data) {
      behaviorList.innerHTML = '<li class="behavior-item">⚠️ Unable to analyze this page</li>';
      riskBadge.textContent = 'Unknown';
      riskBadge.className = 'risk-badge risk-warning';
    } else {
      const { behaviorData, riskScore } = data;

      // Set risk badge
      let riskLevel, riskClass, riskText;
      if (riskScore >= 30) {
        riskLevel = 'CRITICAL';
        riskClass = 'risk-critical';
        riskText = `CRITICAL (${riskScore}/40)`;
      } else if (riskScore >= 15) {
        riskLevel = 'WARNING';
        riskClass = 'risk-warning';
        riskText = `WARNING (${riskScore}/40)`;
      } else {
        riskLevel = 'SAFE';
        riskClass = 'risk-safe';
        riskText = `SAFE (${riskScore}/40)`;
      }

      riskBadge.textContent = riskText;
      riskBadge.className = `risk-badge ${riskClass}`;

      // Build behavior list
      const behaviors = [];

      if (behaviorData.countdownTimers.detected) {
        const status = behaviorData.countdownTimers.isFake ? '🚨 Fake' : '⚠️';
        behaviors.push(`${status} Countdown timer detected`);
      }

      if (behaviorData.clipboardAccess.modified) {
        behaviors.push('🚨 Clipboard hijacking detected!');
      }

      if (behaviorData.redirects.suspicious) {
        behaviors.push(`⚠️ Multiple redirects (${behaviorData.redirects.count})`);
      }

      if (behaviorData.hiddenFields.count > 0) {
        behaviors.push(`⚠️ ${behaviorData.hiddenFields.count} suspicious hidden field(s)`);
      }

      if (behaviorData.popups.count >= 3) {
        behaviors.push(`⚠️ Aggressive popups (${behaviorData.popups.count})`);
      }

      if (behaviorData.autoActions.autoSubmit) {
        behaviors.push('⚠️ Auto-submit form detected');
      }

      if (behaviorData.autoActions.autoDownload) {
        behaviors.push('⚠️ Auto-download detected');
      }

      if (behaviors.length === 0) {
        behaviors.push('✅ No suspicious behaviors detected');
      }

      behaviorList.innerHTML = behaviors
        .map(b => `<li class="behavior-item">${b}</li>`)
        .join('');
    }

    loadingEl.style.display = 'none';
    resultsEl.style.display = 'block';
  } catch (error) {
    console.error('Error displaying results:', error);
    loadingEl.textContent = '❌ Error analyzing page';
  }
}

// Full scan button
document.getElementById('fullScanBtn')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;

  // Open Elara web app with full scan
  chrome.tabs.create({
    url: `https://elara-app.com/scan?url=${encodeURIComponent(url)}`,
  });
});

// Report button
document.getElementById('reportBtn')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;

  // Open Elara report page
  chrome.tabs.create({
    url: `https://elara-app.com/report?url=${encodeURIComponent(url)}`,
  });
});

// Load results on popup open
displayResults();
