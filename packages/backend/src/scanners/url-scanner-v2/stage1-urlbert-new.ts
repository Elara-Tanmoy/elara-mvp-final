  /**
   * Local URLBERT fallback - now with real ML-based detection
   */
  private localURLBERTFallback(tokens: string[]): {
    probability: number;
    confidence: number;
  } {
    // NEW: Try ML-based detection first (from ml-models.ts)
    try {
      const analyzer = createURLRiskAnalyzer();

      // Reconstruct URL from tokens
      const url = tokens.join('');

      // Run comprehensive ML analysis
      const analysis = analyzer.analyze(url);

      console.log(`[Stage1] URLBERT with ML Models:`);
      console.log(`  - Probability: ${(analysis.probability * 100).toFixed(1)}%`);
      console.log(`  - Confidence: ${analysis.confidence.toFixed(2)}`);
      console.log(`  - Detections:`, analysis.detections);

      // If ML model has reasonable confidence, use its result
      if (analysis.confidence > 0.5) {
        return {
          probability: analysis.probability,
          confidence: analysis.confidence
        };
      }
    } catch (error) {
      console.error('[Stage1] URL risk analysis error, falling back to heuristic:', error);
    }

    // FALLBACK: Use existing heuristic if ML fails or has low confidence
    let riskScore = 0;

    // 1. Suspicious brand/service tokens (phishing indicators)
    const brandTokens = [
      'paypal', 'amazon', 'ebay', 'apple', 'microsoft', 'google',
      'bank', 'chase', 'wellsfargo', 'citibank', 'netflix', 'facebook'
    ];
    const actionTokens = [
      'login', 'signin', 'verify', 'account', 'update', 'secure',
      'confirm', 'validate', 'authenticate', 'suspended', 'locked'
    ];

    const brandCount = tokens.filter(token =>
      brandTokens.some(brand => token.toLowerCase().includes(brand))
    ).length;

    const actionCount = tokens.filter(token =>
      actionTokens.some(action => token.toLowerCase().includes(action))
    ).length;

    // Brand + action = classic phishing pattern
    if (brandCount > 0 && actionCount > 0) {
      riskScore += 0.40; // Strong phishing signal
    } else if (actionCount > 1) {
      riskScore += 0.25; // Multiple actions suspicious
    } else if (brandCount > 0) {
      riskScore += 0.15; // Brand mention alone
    }

    // 2. Suspicious TLD patterns in URL path
    const suspiciousTLDTokens = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top'];
    const hasSuspiciousTLD = tokens.some(token =>
      suspiciousTLDTokens.some(tld => token === tld)
    );
    if (hasSuspiciousTLD) {
      riskScore += 0.20;
    }

    // 3. URL length and complexity
    const totalLength = tokens.join('').length;
    if (totalLength > 100) {
      riskScore += 0.15; // Very long URLs are suspicious
    } else if (totalLength < 10) {
      riskScore += 0.10; // Very short URLs can be suspicious too
    }

    // 4. Number tokens (often used in phishing: paypal-verify-123456)
    const numberTokens = tokens.filter(token => /^\d+$/.test(token)).length;
    if (numberTokens > 2) {
      riskScore += 0.15; // Multiple number sequences
    }

    // 5. Special character density
    const specialChars = tokens.filter(token =>
      /^[^a-zA-Z0-9]+$/.test(token) && token.length === 1
    ).length;
    const specialCharRatio = specialChars / tokens.length;
    if (specialCharRatio > 0.3) {
      riskScore += 0.15; // High special character density
    }

    // 6. Homoglyph/look-alike patterns (common in phishing)
    const homoglyphTokens = tokens.filter(token =>
      /[а-яА-Я0Oo1Il]/.test(token) // Cyrillic or common lookalikes
    ).length;
    if (homoglyphTokens > 0) {
      riskScore += 0.20; // Homoglyph detected
    }

    // 7. URL depth (number of path separators)
    const pathDepth = tokens.filter(token => token === '/').length;
    if (pathDepth > 5) {
      riskScore += 0.10; // Very deep URL structure
    }

    // Normalize probability
    const probability = Math.min(0.95, riskScore);

    // Confidence based on number of signals triggered
    // More signals = higher confidence in our heuristic
    const signalCount = [
      brandCount > 0,
      actionCount > 0,
      hasSuspiciousTLD,
      totalLength > 100 || totalLength < 10,
      numberTokens > 2,
      specialCharRatio > 0.3,
      homoglyphTokens > 0,
      pathDepth > 5
    ].filter(Boolean).length;

    const confidence = Math.min(0.7, signalCount * 0.1); // Max 70% confidence for heuristic

    console.log(`[Stage1] URLBERT Fallback: prob=${(probability * 100).toFixed(1)}%, conf=${confidence.toFixed(2)} (${signalCount} signals)`);

    return { probability, confidence };
  }
