# Using V2ScanResultsEnhanced Component

## Quick Start

Replace your existing V2ScanResults component with the new enhanced version:

```typescript
// Before
import V2ScanResults from './components/ScanResults/V2ScanResults';

// After
import V2ScanResultsEnhanced from './components/ScanResults/V2ScanResultsEnhanced';

// Usage
<V2ScanResultsEnhanced scan={scanResult} />
```

## Features

### 1. Trust Score Gauge
- Large animated circular gauge showing trust score (0-100)
- Color-coded: Green (76+), Yellow (61-75), Orange (31-60), Red (0-30)
- Smooth animation on page load

### 2. Final Verdict Card
- Most prominent element at the top
- Shows: SAFE / SUSPICIOUS / DANGEROUS / UNKNOWN
- Includes emoji, color coding, summary, and recommendation
- Visual badges for quick insights

### 3. Key Findings (Highlights)
- Two-column layout
- **Left**: Positive Indicators (green checkmarks)
- **Right**: Red Flags (red X marks)
- Up to 8 positive and 10 negative highlights

### 4. Evidence Cards
Three beautiful cards showing:
- **Domain Info**: Age, rank, status
- **Security**: SSL, login forms, downloads
- **Threat Intel**: Database hits, risk score

### 5. Screenshot Display
- Full-width image with border and shadow
- Automatic fallback to placeholder on error
- Timestamp caption

### 6. ML Detection Stages
- Stage-1: 3 models with performance metrics
- Stage-2: Deep analysis (if ran)
- Gradient backgrounds for visual appeal
- Early exit indicator

### 7. Detailed Security Checks
- Shows only FAIL and WARNING checks
- Sorted by severity
- Points scored vs max points
- Status badges

## Styling

The component uses:
- Tailwind CSS classes
- lucide-react icons
- Responsive grid layouts
- Hover effects and transitions
- Color-coded elements throughout

## Required Props

```typescript
interface V2ScanResultsEnhancedProps {
  scan: {
    // Core
    url: string;
    scanId: string;
    timestamp: Date;
    riskScore: number;
    riskLevel: string;
    reachability: string;

    // NEW: Final Verdict
    finalVerdict?: {
      verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
      trustScore: number;
      summary: string;
      recommendation: string;
      positiveHighlights: string[];
      negativeHighlights: string[];
      badges: Array<{
        type: 'success' | 'warning' | 'danger' | 'info';
        icon: string;
        text: string;
      }>;
    };

    // Evidence
    evidenceSummary: {
      domainAge: number;
      tlsValid: boolean;
      tiHits: number;
      hasLoginForm: boolean;
      autoDownload: boolean;
    };

    // Optional
    screenshotUrl?: string;
    reputationInfo?: {
      rank: number;
      trustScore: number;
      trustLevel: string;
    };
    stage1?: any;
    stage2?: any;
    granularChecks?: Array<any>;
    latency?: any;
  };
}
```

## Collapsible Sections

Sections can be toggled:
- Key Findings (highlights)
- Screenshot
- ML Detection Stages
- Detailed Security Checks

Default expanded: verdict, highlights, evidence

## Color Scheme

### Trust Score Colors:
- **Green** (76-100): Safe, legitimate
- **Yellow** (61-75): Caution needed
- **Orange** (31-60): Suspicious, high risk
- **Red** (0-30): Dangerous, avoid

### Verdict Colors:
- **SAFE**: Green theme
- **SUSPICIOUS**: Yellow theme
- **DANGEROUS**: Red theme
- **UNKNOWN**: Gray theme

## Example Usage in Your App

```tsx
import React from 'react';
import V2ScanResultsEnhanced from './components/ScanResults/V2ScanResultsEnhanced';

function ScanResultsPage() {
  const [scanResult, setScanResult] = React.useState(null);

  React.useEffect(() => {
    // Fetch scan result from API
    fetch('/api/scan/v2?url=https://example.com')
      .then(res => res.json())
      .then(data => setScanResult(data));
  }, []);

  if (!scanResult) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <V2ScanResultsEnhanced scan={scanResult} />
    </div>
  );
}

export default ScanResultsPage;
```

## Migration from Old Component

If you're migrating from the old V2ScanResults component:

1. **Install lucide-react** (if not already installed):
   ```bash
   npm install lucide-react
   ```

2. **Replace import**:
   ```typescript
   // Old
   import V2ScanResults from './components/ScanResults/V2ScanResults';

   // New
   import V2ScanResultsEnhanced from './components/ScanResults/V2ScanResultsEnhanced';
   ```

3. **Use same props** - The component is backward compatible with existing scan results.

4. **Enjoy the new UI** - The enhanced component will automatically use the new `finalVerdict` data if available, and fall back to calculating trust score from `riskScore`.

## Troubleshooting

### Trust Score Not Showing
- Check if `scan.finalVerdict.trustScore` exists
- Falls back to `100 - scan.riskScore` if not available

### Screenshot Not Displaying
- Check if `scan.screenshotUrl` is set
- Component will show placeholder if image fails to load
- Ensure screenshot URLs are accessible (CORS, authentication)

### Highlights Not Showing
- Check if `scan.finalVerdict` object exists
- Requires backend to have `verdict-generator.ts` integrated
- Will hide section if no highlights available

### Badges Not Displaying
- Check `scan.finalVerdict.badges` array
- Verify badge objects have `type`, `icon`, and `text` properties

## Performance

- Component is optimized for large scan results
- Uses React state for collapsible sections (no re-renders of entire component)
- Lazy loads images
- CSS transitions for smooth animations
- Limited to 20 displayed granular checks by default (can be adjusted)

## Browser Compatibility

- Requires modern browser with ES6+ support
- Tailwind CSS v3+
- React 17+
- lucide-react icons

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast colors for readability
- Focus indicators on buttons
