# Elara Platform - Environment Validation Script
# Validates that restored environment is fully operational

param(
    [Parameter(Mandatory=$false)]
    [string]$Project = "elara-mvp-13082025-u1",

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-west1",

    [Parameter(Mandatory=$false)]
    [string]$Domain,

    [Parameter(Mandatory=$false)]
    [switch]$Detailed
)

$ErrorActionPreference = "Continue"

# Color output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    $colors = @{
        "Green" = "32"; "Yellow" = "33"; "Red" = "31";
        "Blue" = "34"; "Magenta" = "35"; "Cyan" = "36"
    }
    if ($colors.ContainsKey($Color)) {
        Write-Host "`e[$($colors[$Color])m$Message`e[0m"
    } else {
        Write-Host $Message
    }
}

function Test-Component {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$FailureMessage
    )

    Write-Host -NoNewline "Checking: $Name".PadRight(60)

    try {
        $result = & $Test
        if ($result.Success) {
            Write-ColorOutput "✅ OK $($result.Details)" "Green"
            return @{ Component = $Name; Status = "OK"; Details = $result.Details }
        } else {
            Write-ColorOutput "❌ FAIL $($result.Details)" "Red"
            return @{ Component = $Name; Status = "FAIL"; Details = $result.Details }
        }
    } catch {
        Write-ColorOutput "❌ ERROR $_" "Red"
        return @{ Component = $Name; Status = "ERROR"; Details = $_.Exception.Message }
    }
}

Write-ColorOutput @"

╔═══════════════════════════════════════════════════════════════╗
║           ELARA PLATFORM - ENVIRONMENT VALIDATION             ║
╚═══════════════════════════════════════════════════════════════╝

Project:  $Project
Region:   $Region
Time:     $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@ "Cyan"

$results = @()

# ============================================================================
# INFRASTRUCTURE CHECKS
# ============================================================================

Write-ColorOutput "`n[INFRASTRUCTURE CHECKS]" "Blue"

# Check GKE Cluster
$results += Test-Component -Name "GKE Cluster" -Test {
    $cluster = gcloud container clusters describe elara-gke-cluster --region=$Region --project=$Project --format=json 2>$null | ConvertFrom-Json
    if ($cluster.status -eq "RUNNING") {
        return @{ Success = $true; Details = "($($cluster.currentNodeCount) nodes)" }
    } else {
        return @{ Success = $false; Details = "(status: $($cluster.status))" }
    }
}

# Check Cloud SQL
$results += Test-Component -Name "Cloud SQL (PostgreSQL)" -Test {
    $instance = gcloud sql instances describe elara-postgres-primary --project=$Project --format=json 2>$null | ConvertFrom-Json
    if ($instance.state -eq "RUNNABLE") {
        return @{ Success = $true; Details = "($($instance.databaseVersion))" }
    } else {
        return @{ Success = $false; Details = "(state: $($instance.state))" }
    }
}

# Check Redis
$results += Test-Component -Name "Redis Instance" -Test {
    $redis = gcloud redis instances describe elara-redis --region=$Region --project=$Project --format=json 2>$null | ConvertFrom-Json
    if ($redis.state -eq "READY") {
        return @{ Success = $true; Details = "($($redis.memorySizeGb)GB)" }
    } else {
        return @{ Success = $false; Details = "(state: $($redis.state))" }
    }
}

# ============================================================================
# KUBERNETES CHECKS
# ============================================================================

Write-ColorOutput "`n[KUBERNETES CHECKS]" "Blue"

# Configure kubectl
gcloud container clusters get-credentials elara-gke-cluster --region=$Region --project=$Project 2>&1 | Out-Null

# Check Namespaces
$results += Test-Component -Name "Namespaces" -Test {
    $namespaces = @("elara-backend-prod", "elara-frontend-prod", "elara-workers-prod", "elara-proxy")
    $existing = kubectl get namespaces -o name 2>$null | ForEach-Object { $_ -replace "namespace/", "" }
    $missing = $namespaces | Where-Object { $_ -notin $existing }

    if ($missing.Count -eq 0) {
        return @{ Success = $true; Details = "($($namespaces.Count) namespaces)" }
    } else {
        return @{ Success = $false; Details = "(missing: $($missing -join ', '))" }
    }
}

# Check Backend Pods
$results += Test-Component -Name "Backend Pods" -Test {
    $pods = kubectl get pods -n elara-backend-prod --no-headers 2>$null
    if ($pods) {
        $running = ($pods | Select-String "Running" | Measure-Object).Count
        $total = ($pods | Measure-Object -Line).Lines
        if ($running -eq $total) {
            return @{ Success = $true; Details = "($running/$total running)" }
        } else {
            return @{ Success = $false; Details = "($running/$total running)" }
        }
    } else {
        return @{ Success = $false; Details = "(no pods found)" }
    }
}

# Check Frontend Pods
$results += Test-Component -Name "Frontend Pods" -Test {
    $pods = kubectl get pods -n elara-frontend-prod --no-headers 2>$null
    if ($pods) {
        $running = ($pods | Select-String "Running" | Measure-Object).Count
        $total = ($pods | Measure-Object -Line).Lines
        if ($running -eq $total) {
            return @{ Success = $true; Details = "($running/$total running)" }
        } else {
            return @{ Success = $false; Details = "($running/$total running)" }
        }
    } else {
        return @{ Success = $false; Details = "(no pods found)" }
    }
}

# Check Worker Pods
$results += Test-Component -Name "Worker Pods" -Test {
    $pods = kubectl get pods -n elara-workers-prod --no-headers 2>$null
    if ($pods) {
        $running = ($pods | Select-String "Running" | Measure-Object).Count
        $total = ($pods | Measure-Object -Line).Lines
        if ($running -eq $total) {
            return @{ Success = $true; Details = "($running/$total running)" }
        } else {
            return @{ Success = $false; Details = "($running/$total running)" }
        }
    } else {
        return @{ Success = $false; Details = "(no pods found)" }
    }
}

# Check Services
$results += Test-Component -Name "Kubernetes Services" -Test {
    $services = kubectl get services --all-namespaces --no-headers 2>$null | Measure-Object -Line
    if ($services.Lines -gt 0) {
        return @{ Success = $true; Details = "($($services.Lines) services)" }
    } else {
        return @{ Success = $false; Details = "(no services found)" }
    }
}

# Check Load Balancer
$results += Test-Component -Name "Load Balancer" -Test {
    $lb = kubectl get service -n elara-proxy elara-ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
    if ($lb) {
        return @{ Success = $true; Details = "($lb)" }
    } else {
        return @{ Success = $false; Details = "(IP not assigned yet)" }
    }
}

# ============================================================================
# APPLICATION HEALTH CHECKS
# ============================================================================

Write-ColorOutput "`n[APPLICATION HEALTH CHECKS]" "Blue"

# Get Load Balancer IP
$lbIP = kubectl get service -n elara-proxy elara-ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null

if ($Domain) {
    $baseUrl = "https://$Domain"
} elseif ($lbIP) {
    $baseUrl = "http://$lbIP"
} else {
    Write-ColorOutput "⚠️  Load balancer IP not available - skipping HTTP checks" "Yellow"
    $baseUrl = $null
}

if ($baseUrl) {
    # Check Frontend
    $results += Test-Component -Name "Frontend (HTTP)" -Test {
        try {
            $response = Invoke-WebRequest -Uri $baseUrl -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            $duration = [math]::Round($response.Headers['X-Response-Time'], 0)
            if ($response.StatusCode -eq 200) {
                return @{ Success = $true; Details = "(${duration}ms)" }
            } else {
                return @{ Success = $false; Details = "(status: $($response.StatusCode))" }
            }
        } catch {
            return @{ Success = $false; Details = "($($_.Exception.Message))" }
        }
    }

    # Check Backend API Health
    $results += Test-Component -Name "Backend API (/v2/health)" -Test {
        try {
            $start = Get-Date
            $response = Invoke-RestMethod -Uri "$baseUrl/v2/health" -TimeoutSec 10 -ErrorAction Stop
            $duration = [math]::Round(((Get-Date) - $start).TotalMilliseconds, 0)

            if ($response.status -eq "ok" -or $response.success -eq $true) {
                return @{ Success = $true; Details = "(${duration}ms)" }
            } else {
                return @{ Success = $false; Details = "(status: $($response.status))" }
            }
        } catch {
            return @{ Success = $false; Details = "($($_.Exception.Message))" }
        }
    }
}

# ============================================================================
# DATABASE CONNECTIVITY
# ============================================================================

Write-ColorOutput "`n[DATABASE CONNECTIVITY]" "Blue"

# Check Database from Backend Pod
$results += Test-Component -Name "Database Connectivity" -Test {
    $pod = kubectl get pods -n elara-backend-prod -l app=elara-api -o name 2>$null | Select-Object -First 1
    if ($pod) {
        $dbCheck = kubectl exec $pod -n elara-backend-prod -- sh -c "timeout 5 psql `$DATABASE_URL -c 'SELECT 1' 2>&1" 2>$null
        if ($dbCheck -match "1 row") {
            return @{ Success = $true; Details = "(connected)" }
        } else {
            return @{ Success = $false; Details = "(connection failed)" }
        }
    } else {
        return @{ Success = $false; Details = "(no backend pod found)" }
    }
}

# Check Redis from Backend Pod
$results += Test-Component -Name "Redis Connectivity" -Test {
    $pod = kubectl get pods -n elara-backend-prod -l app=elara-api -o name 2>$null | Select-Object -First 1
    if ($pod) {
        $redisCheck = kubectl exec $pod -n elara-backend-prod -- sh -c "timeout 5 redis-cli -u `$REDIS_URL PING 2>&1" 2>$null
        if ($redisCheck -match "PONG") {
            return @{ Success = $true; Details = "(connected)" }
        } else {
            return @{ Success = $false; Details = "(connection failed)" }
        }
    } else {
        return @{ Success = $false; Details = "(no backend pod found)" }
    }
}

# ============================================================================
# SSL & DNS CHECKS
# ============================================================================

if ($Domain) {
    Write-ColorOutput "`n[SSL & DNS CHECKS]" "Blue"

    # Check DNS Resolution
    $results += Test-Component -Name "DNS Resolution" -Test {
        try {
            $dns = Resolve-DnsName $Domain -ErrorAction Stop
            $ip = $dns | Where-Object { $_.Type -eq "A" } | Select-Object -ExpandProperty IPAddress -First 1
            if ($ip -eq $lbIP) {
                return @{ Success = $true; Details = "($ip)" }
            } else {
                return @{ Success = $false; Details = "(points to $ip, expected $lbIP)" }
            }
        } catch {
            return @{ Success = $false; Details = "(not resolvable)" }
        }
    }

    # Check SSL Certificate
    $results += Test-Component -Name "SSL Certificate" -Test {
        try {
            $request = [System.Net.HttpWebRequest]::Create("https://$Domain")
            $request.Timeout = 10000
            $response = $request.GetResponse()
            $cert = $request.ServicePoint.Certificate
            $expiryDate = [datetime]::Parse($cert.GetExpirationDateString())
            $daysRemaining = ($expiryDate - (Get-Date)).Days

            if ($daysRemaining -gt 0) {
                return @{ Success = $true; Details = "($daysRemaining days remaining)" }
            } else {
                return @{ Success = $false; Details = "(expired)" }
            }
        } catch {
            return @{ Success = $false; Details = "($($_.Exception.Message))" }
        }
    }
}

# ============================================================================
# DETAILED POD STATUS
# ============================================================================

if ($Detailed) {
    Write-ColorOutput "`n[DETAILED POD STATUS]" "Blue"

    $namespaces = @("elara-backend-prod", "elara-frontend-prod", "elara-workers-prod")
    foreach ($ns in $namespaces) {
        Write-Host "`n$ns:"
        kubectl get pods -n $ns 2>$null
    }
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-ColorOutput "`n╔═══════════════════════════════════════════════════════════════╗" "Cyan"
Write-ColorOutput "║                    VALIDATION SUMMARY                         ║" "Cyan"
Write-ColorOutput "╚═══════════════════════════════════════════════════════════════╝" "Cyan"

$passed = ($results | Where-Object { $_.Status -eq "OK" }).Count
$failed = ($results | Where-Object { $_.Status -ne "OK" }).Count
$total = $results.Count

Write-Host ""
Write-ColorOutput "Total Checks:     $total" "White"
Write-ColorOutput "Passed:           $passed" "Green"
if ($failed -gt 0) {
    Write-ColorOutput "Failed:           $failed" "Red"
} else {
    Write-ColorOutput "Failed:           $failed" "Green"
}

Write-Host ""

if ($failed -eq 0) {
    Write-ColorOutput "Environment Status: ✅ FULLY OPERATIONAL" "Green"
    Write-Host ""
    Write-Host "Your Elara Platform is ready for use!"
    if ($baseUrl) {
        Write-Host ""
        Write-ColorOutput "Access your application at: $baseUrl" "Cyan"
    }
} else {
    Write-ColorOutput "Environment Status: ⚠️  ISSUES DETECTED" "Yellow"
    Write-Host ""
    Write-Host "Failed checks:"
    foreach ($result in $results | Where-Object { $_.Status -ne "OK" }) {
        Write-ColorOutput "  - $($result.Component): $($result.Details)" "Red"
    }
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  1. Check pod logs: kubectl logs -n <namespace> <pod-name>"
    Write-Host "  2. Check events: kubectl get events --all-namespaces --sort-by='.lastTimestamp'"
    Write-Host "  3. Verify database connection strings in secrets"
    Write-Host "  4. Ensure all services are running: kubectl get services --all-namespaces"
}

Write-Host ""
Write-ColorOutput "Validation completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Cyan"
Write-Host ""

# Export results to JSON
$reportPath = "validation-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$report = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    project = $Project
    region = $Region
    domain = $Domain
    total_checks = $total
    passed = $passed
    failed = $failed
    results = $results
}
$report | ConvertTo-Json -Depth 5 | Out-File -FilePath $reportPath -Encoding utf8
Write-ColorOutput "Detailed report saved to: $reportPath" "Cyan"
Write-Host ""

exit $failed
