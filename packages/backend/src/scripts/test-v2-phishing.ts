/**
 * Test V2 Scanner with Known Phishing URLs
 *
 * This script tests the V2 scanner against known active phishing URLs
 * to validate that aggressive detection rules are working correctly.
 */

import axios from 'axios';

const PHISHING_URLS = [
  'http://000000000000000000000000000yteyeuya.000webhostapp.com/yahoo/yahooattt/global/attverzon/login.php',
  'http://000025123.com/banks/cibc',
  'http://00003485.com/banks/td',
  'http://000025123.com/banks/simplii'
];

const LEGITIMATE_URLS = [
  'https://google.com',
  'https://github.com',
  'https://microsoft.com'
];

interface ScanResult {
  url: string;
  riskLevel: string;
  riskScore: number;
  probability: number;
  reachability: string;
  granularChecks: any[];
  categoryResults?: {
    totalPoints: number;
    totalPossible: number;
    riskFactor: number;
    categories: Array<{ name: string; points: number; maxPoints: number }>;
  };
}

async function testPhishingDetection() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  V2 Scanner Phishing Detection Calibration Test               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results: Array<{ url: string; result: ScanResult | null; error?: string; passed: boolean }> = [];

  console.log('Testing Known Phishing URLs...\n');
  console.log('Expected: Risk Level D, E, or F (High/Critical/Severe)\n');

  for (const url of PHISHING_URLS) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing: ${url}`);
      console.log('='.repeat(80));

      const response = await axios.post('http://localhost:5001/api/scan/url/v2', {
        url,
        options: { enableExplainability: true }
      }, {
        headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' },
        timeout: 60000
      });

      const result: ScanResult = response.data;

      console.log(`\nRisk Level: ${result.riskLevel} (${result.riskScore}%)`);
      console.log(`Probability: ${(result.probability * 100).toFixed(1)}%`);
      console.log(`Reachability: ${result.reachability}`);
      console.log(`Granular Checks: ${result.granularChecks?.length || 0}`);

      if (result.categoryResults) {
        const { totalPoints, totalPossible, riskFactor } = result.categoryResults;
        console.log(`Category Risk: ${totalPoints}/${totalPossible} points (${(riskFactor * 100).toFixed(1)}% risk factor)`);

        console.log('\nCategory Breakdown:');
        result.categoryResults.categories.forEach(cat => {
          if (cat.points > 0) {
            console.log(`  - ${cat.name}: ${cat.points}/${cat.maxPoints} penalty points`);
          }
        });
      }

      // Show failed checks
      const failedChecks = result.granularChecks?.filter((c: any) => c.status === 'FAIL') || [];
      if (failedChecks.length > 0) {
        console.log(`\nFailed Checks (${failedChecks.length}):`);
        failedChecks.forEach((check: any) => {
          console.log(`  ❌ [${check.category}] ${check.name}`);
          console.log(`     ${check.description}`);
        });
      }

      // VALIDATION
      const isPassed = result.riskLevel === 'D' || result.riskLevel === 'E' || result.riskLevel === 'F';

      if (result.riskLevel === 'A' || result.riskLevel === 'B') {
        console.log('\n❌ FAILED: Phishing URL detected as LOW RISK!');
      } else if (result.riskLevel === 'C') {
        console.log('\n⚠️  PARTIAL: Detected as suspicious (C), should be D/E/F');
      } else {
        console.log('\n✅ PASSED: Correctly identified as high-risk threat');
      }

      results.push({ url, result, passed: isPassed });

    } catch (error: any) {
      console.error(`\n❌ ERROR scanning ${url}:`, error.message);
      results.push({ url, result: null, error: error.message, passed: false });
    }
  }

  // Test legitimate URLs (should NOT be flagged as high-risk)
  console.log('\n\n' + '='.repeat(80));
  console.log('Testing Legitimate URLs...');
  console.log('Expected: Risk Level A or B (Safe/Low Risk)');
  console.log('='.repeat(80));

  for (const url of LEGITIMATE_URLS) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing: ${url}`);
      console.log('='.repeat(80));

      const response = await axios.post('http://localhost:5001/api/scan/url/v2', {
        url,
        options: { enableExplainability: true }
      }, {
        headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' },
        timeout: 60000
      });

      const result: ScanResult = response.data;

      console.log(`\nRisk Level: ${result.riskLevel} (${result.riskScore}%)`);
      console.log(`Probability: ${(result.probability * 100).toFixed(1)}%`);

      // VALIDATION - legitimate sites should be A or B
      const isPassed = result.riskLevel === 'A' || result.riskLevel === 'B';

      if (result.riskLevel === 'D' || result.riskLevel === 'E' || result.riskLevel === 'F') {
        console.log('\n❌ FAILED: Legitimate URL flagged as high-risk (false positive)');
      } else if (result.riskLevel === 'C') {
        console.log('\n⚠️  WARNING: Legitimate URL flagged as medium risk');
      } else {
        console.log('\n✅ PASSED: Correctly identified as safe/low risk');
      }

      results.push({ url, result, passed: isPassed });

    } catch (error: any) {
      console.error(`\n❌ ERROR scanning ${url}:`, error.message);
      results.push({ url, result: null, error: error.message, passed: false });
    }
  }

  // Summary
  console.log('\n\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(30) + 'TEST SUMMARY' + ' '.repeat(36) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Detailed breakdown
  console.log('Detailed Results:');
  results.forEach(({ url, result, error, passed }) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const riskInfo = result ? `${result.riskLevel} (${result.riskScore}%)` : 'ERROR';
    console.log(`  ${status} - ${url}`);
    console.log(`           Risk: ${riskInfo}`);
    if (error) console.log(`           Error: ${error}`);
  });

  console.log('\n' + '═'.repeat(80) + '\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
testPhishingDetection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
