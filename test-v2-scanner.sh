#!/bin/bash
# Test V2 Scanner End-to-End
# Usage: bash test-v2-scanner.sh

set -e

API_URL="https://api.oelara.com"
TEST_URL="http://creditiperhabbogratissicuro100.blogspot.com"
EMAIL="admin@oelara.com"
PASSWORD="ElaraAdmin2025!"

echo "=== V2 Scanner E2E Test ==="
echo ""

# Step 1: Login and get token
echo "[1/4] Logging in as $EMAIL..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in successfully"
echo ""

# Step 2: Submit scan
echo "[2/4] Submitting scan for: $TEST_URL"
SCAN_RESPONSE=$(curl -s -X POST "$API_URL/api/scan/urls" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"url\":\"$TEST_URL\"}")

SCAN_ID=$(echo "$SCAN_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SCAN_ID" ]; then
  echo "ERROR: Failed to submit scan"
  echo "Response: $SCAN_RESPONSE"
  exit 1
fi

echo "✓ Scan submitted: $SCAN_ID"
echo ""

# Step 3: Monitor scan status
echo "[3/4] Monitoring scan status..."
MAX_WAIT=300  # 5 minutes
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/scan/$SCAN_ID" \
    -H "Authorization: Bearer $TOKEN")

  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

  echo "  [$ELAPSED s] Status: $STATUS"

  if [ "$STATUS" = "completed" ]; then
    echo "✓ Scan completed successfully!"
    echo ""
    echo "Full response:"
    echo "$STATUS_RESPONSE" | python -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "ERROR: Scan failed"
    echo "Response: $STATUS_RESPONSE"
    exit 1
  fi

  sleep 10
  ELAPSED=$((ELAPSED + 10))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "ERROR: Scan timeout after $MAX_WAIT seconds"
  echo "Last status: $STATUS"
  exit 1
fi

echo ""
echo "[4/4] Checking backend logs for errors..."
kubectl logs -l app=elara-backend -n elara-proxy --tail=50 | grep -i "v2.*error\|tiData" || echo "✓ No V2 scanner errors found"

echo ""
echo "=== Test Complete ==="
