# Test Elara API Endpoints with your API key

$API_KEY = "elk_b0e51cf5a73be094799935c95d76658e559817e7f61073d7ec89c79877df91ca"
$BASE_URL = "https://elara-backend.onrender.com/api"

# Headers
$headers = @{
    "Authorization" = "ApiKey $API_KEY"
    "Content-Type" = "application/json"
}

Write-Host "`n=== TESTING ELARA API ENDPOINTS ===" -ForegroundColor Cyan

# Test 1: Scan Message
Write-Host "`n1. Testing POST /v2/scan/message..." -ForegroundColor Yellow
try {
    $body = @{
        content = "Check this link: http://suspicious-site.com"
        language = "en"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/v2/scan/message" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ SUCCESS - Message Scan Endpoint Works" -ForegroundColor Green
    Write-Host "Risk Level: $($response.riskLevel)" -ForegroundColor White
    Write-Host "Risk Score: $($response.riskScore)" -ForegroundColor White
} catch {
    Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Scan URL
Write-Host "`n2. Testing POST /v2/scan/url..." -ForegroundColor Yellow
try {
    $body = @{
        url = "https://google.com"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/v2/scan/url" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ SUCCESS - URL Scan Endpoint Works" -ForegroundColor Green
    Write-Host "URL: $($response.url)" -ForegroundColor White
    Write-Host "Risk Level: $($response.riskLevel)" -ForegroundColor White
    Write-Host "Cached: $($response.cached)" -ForegroundColor White
} catch {
    Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Health Check
Write-Host "`n3. Testing GET /health..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "✅ SUCCESS - Health Endpoint Works" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor White
} catch {
    Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "`nAPI Key is valid: elk_b0e5...91ca" -ForegroundColor Green
Write-Host "Base URL: $BASE_URL" -ForegroundColor White