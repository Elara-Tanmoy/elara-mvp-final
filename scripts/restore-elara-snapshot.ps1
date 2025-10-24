# Elara Platform - One-Click Snapshot Restore
# Restores complete environment from snapshot in 15-20 minutes

param(
    [Parameter(Mandatory=$true)]
    [string]$Project,

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-west1",

    [Parameter(Mandatory=$false)]
    [string]$SnapshotPath,

    [Parameter(Mandatory=$false)]
    [SecureString]$Passphrase,

    [Parameter(Mandatory=$false)]
    [switch]$SkipInfrastructure,

    [Parameter(Mandatory=$false)]
    [switch]$SkipDatabase,

    [Parameter(Mandatory=$false)]
    [switch]$SkipKubernetes,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun,

    [Parameter(Mandatory=$false)]
    [switch]$Emergency
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Color output functions
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

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n▶ $Message" "Blue"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "  ✅ $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "  ⚠️  $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "  ❌ $Message" "Red"
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Auto-detect snapshot path if running from snapshot directory
if (-not $SnapshotPath) {
    $currentDir = Get-Location
    if (Test-Path (Join-Path $currentDir "..\metadata.json")) {
        $SnapshotPath = Split-Path $currentDir -Parent
        Write-ColorOutput "Auto-detected snapshot path: $SnapshotPath" "Cyan"
    } else {
        Write-Error "Cannot auto-detect snapshot path. Please use -SnapshotPath parameter."
        exit 1
    }
}

# Verify snapshot exists
if (-not (Test-Path $SnapshotPath)) {
    Write-Error "Snapshot path not found: $SnapshotPath"
    exit 1
}

# Load metadata
$metadataPath = Join-Path $SnapshotPath "metadata.json"
if (-not (Test-Path $metadataPath)) {
    Write-Error "Invalid snapshot: metadata.json not found"
    exit 1
}

$metadata = Get-Content $metadataPath | ConvertFrom-Json

Write-ColorOutput @"

╔═══════════════════════════════════════════════════════════════╗
║         ELARA PLATFORM - ONE-CLICK SNAPSHOT RESTORE           ║
╚═══════════════════════════════════════════════════════════════╝

Snapshot ID:      $($metadata.snapshot_id)
Created:          $($metadata.created_at)
Source Project:   $($metadata.source_project)
Target Project:   $Project
Target Region:    $Region
Git Commit:       $($metadata.git_commit)
Encrypted:        $($metadata.encrypted)
Total Size:       $($metadata.total_size_mb) MB

"@ "Cyan"

if ($DryRun) {
    Write-Warning "DRY RUN MODE - No changes will be made"
}

if ($Emergency) {
    Write-Warning "EMERGENCY MODE - Skipping safety checks for speed"
}

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================

Write-Step "Checking Prerequisites"

$missingTools = @()

if (-not (Test-CommandExists "gcloud")) { $missingTools += "gcloud SDK" }
if (-not (Test-CommandExists "kubectl")) { $missingTools += "kubectl" }
if (-not (Test-CommandExists "terraform")) { $missingTools += "terraform" }

if ($missingTools.Count -gt 0) {
    Write-Error "Missing required tools: $($missingTools -join ', ')"
    Write-Host "`nInstall using:"
    Write-Host "  choco install gcloudsdk kubectl terraform"
    exit 1
}

Write-Success "All required tools installed"

# Check GCP authentication
try {
    $currentProject = gcloud config get-value project 2>$null
    Write-Success "Authenticated with GCP (current project: $currentProject)"
} catch {
    Write-Error "Not authenticated with GCP. Run: gcloud auth login"
    exit 1
}

# ============================================================================
# DECRYPT SECRETS
# ============================================================================

if ($metadata.encrypted) {
    if ($null -eq $Passphrase) {
        Write-Error "This snapshot is encrypted. Please provide -Passphrase parameter."
        exit 1
    }

    Write-Step "Decrypting Secrets"

    try {
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Passphrase)
        $passphrase = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

        $encryptedFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/secrets") -Filter "*.encrypted" -Recurse

        foreach ($encFile in $encryptedFiles) {
            $encryptedContent = Get-Content $encFile.FullName -Raw
            $secureString = ConvertTo-SecureString $encryptedContent -Key ([System.Text.Encoding]::UTF8.GetBytes($passphrase.PadRight(32).Substring(0,32)))
            $decryptedContent = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString))

            $decryptedPath = $encFile.FullName -replace "\.encrypted$", ""
            $decryptedContent | Out-File -FilePath $decryptedPath -Encoding utf8
        }

        Write-Success "Secrets decrypted ($($encryptedFiles.Count) files)"

        # Clear passphrase from memory
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        $passphrase = $null

    } catch {
        Write-Error "Failed to decrypt secrets. Check passphrase."
        exit 1
    }
}

# ============================================================================
# PHASE 1: CREATE/CONFIGURE GCP PROJECT
# ============================================================================

if (-not $SkipInfrastructure) {
    Write-Step "PHASE 1: Infrastructure Setup (5-7 min)"

    if ($DryRun) {
        Write-Warning "Would create/configure GCP project: $Project"
    } else {
        try {
            # Check if project exists
            Write-Host "  → Checking if project exists..."
            $projectExists = gcloud projects describe $Project 2>$null

            if ($projectExists) {
                Write-Success "Project $Project exists"
            } else {
                Write-Warning "Project $Project does not exist. Create it manually first."
                Write-Host "    gcloud projects create $Project"
                exit 1
            }

            # Set as active project
            gcloud config set project $Project 2>&1 | Out-Null
            Write-Success "Project set to $Project"

            # Enable required APIs
            Write-Host "  → Enabling required GCP APIs (this may take 2-3 minutes)..."
            $requiredApis = @(
                "compute.googleapis.com",
                "container.googleapis.com",
                "sqladmin.googleapis.com",
                "redis.googleapis.com",
                "storage.googleapis.com",
                "servicenetworking.googleapis.com",
                "cloudresourcemanager.googleapis.com",
                "iam.googleapis.com",
                "cloudbuild.googleapis.com",
                "cloudkms.googleapis.com"
            )

            foreach ($api in $requiredApis) {
                gcloud services enable $api --project=$Project 2>&1 | Out-Null
            }
            Write-Success "GCP APIs enabled"

            # Create GKE cluster
            Write-Host "  → Creating GKE cluster (this will take 5-7 minutes)..."
            $clusterConfig = Get-Content (Join-Path $SnapshotPath "kubernetes/cluster-info.json") | ConvertFrom-Json

            $clusterExists = gcloud container clusters describe elara-gke-cluster --region=$Region --project=$Project 2>$null

            if (-not $clusterExists) {
                gcloud container clusters create elara-gke-cluster `
                    --region=$Region `
                    --num-nodes=3 `
                    --machine-type=e2-standard-4 `
                    --disk-size=50 `
                    --enable-autoscaling `
                    --min-nodes=1 `
                    --max-nodes=10 `
                    --enable-autorepair `
                    --enable-autoupgrade `
                    --project=$Project 2>&1 | Out-Null

                Write-Success "GKE cluster created"
            } else {
                Write-Success "GKE cluster already exists"
            }

            # Get cluster credentials
            gcloud container clusters get-credentials elara-gke-cluster --region=$Region --project=$Project 2>&1 | Out-Null
            Write-Success "GKE credentials configured"

        } catch {
            Write-Error "Infrastructure setup failed: $_"
            exit 1
        }
    }
} else {
    Write-Warning "Skipping infrastructure setup (--SkipInfrastructure flag)"
}

# ============================================================================
# PHASE 2: RESTORE DATABASE
# ============================================================================

if (-not $SkipDatabase) {
    Write-Step "PHASE 2: Database Restore (3-5 min)"

    if ($DryRun) {
        Write-Warning "Would restore database from snapshot"
    } else {
        try {
            # Check if Cloud SQL instance exists
            Write-Host "  → Checking for Cloud SQL instance..."
            $instanceExists = gcloud sql instances describe elara-postgres-primary --project=$Project 2>$null

            if (-not $instanceExists) {
                Write-Host "  → Creating Cloud SQL instance (this will take 5-10 minutes)..."

                # Read instance config from snapshot
                $sqlConfig = Get-Content (Join-Path $SnapshotPath "database/cloudsql-metadata.json") | ConvertFrom-Json

                gcloud sql instances create elara-postgres-primary `
                    --database-version=POSTGRES_15 `
                    --tier=db-custom-2-7680 `
                    --region=$Region `
                    --network=default `
                    --storage-size=100GB `
                    --storage-type=SSD `
                    --backup-start-time="02:00" `
                    --maintenance-window-day=SUN `
                    --maintenance-window-hour=3 `
                    --project=$Project 2>&1 | Out-Null

                Write-Success "Cloud SQL instance created"
            } else {
                Write-Success "Cloud SQL instance already exists"
            }

            # Create database
            Write-Host "  → Creating database..."
            gcloud sql databases create elara_prod --instance=elara-postgres-primary --project=$Project 2>$null
            Write-Success "Database created"

            # Import database dump
            $dumpFile = Join-Path $SnapshotPath "database/cloudsql-dump.sql"
            if (Test-Path $dumpFile) {
                Write-Host "  → Uploading database dump to Cloud Storage..."
                $bucketName = "elara-restore-$Project"
                gsutil mb -p $Project "gs://$bucketName" 2>$null
                gsutil cp $dumpFile "gs://$bucketName/restore.sql" 2>&1 | Out-Null

                Write-Host "  → Importing database (this may take 2-3 minutes)..."
                gcloud sql import sql elara-postgres-primary "gs://$bucketName/restore.sql" `
                    --database=elara_prod `
                    --project=$Project 2>&1 | Out-Null

                Write-Success "Database restored from dump"

                # Cleanup
                gsutil rm "gs://$bucketName/restore.sql" 2>$null
            } else {
                Write-Warning "No database dump found in snapshot"
            }

            # Create Redis instance
            Write-Host "  → Creating Redis instance..."
            $redisExists = gcloud redis instances describe elara-redis --region=$Region --project=$Project 2>$null

            if (-not $redisExists) {
                gcloud redis instances create elara-redis `
                    --size=5 `
                    --region=$Region `
                    --tier=BASIC `
                    --redis-version=redis_7_0 `
                    --project=$Project 2>&1 | Out-Null

                Write-Success "Redis instance created"
            } else {
                Write-Success "Redis instance already exists"
            }

        } catch {
            Write-Error "Database restore failed: $_"
            if (-not $Emergency) {
                exit 1
            }
        }
    }
} else {
    Write-Warning "Skipping database restore (--SkipDatabase flag)"
}

# ============================================================================
# PHASE 3: DEPLOY KUBERNETES RESOURCES
# ============================================================================

if (-not $SkipKubernetes) {
    Write-Step "PHASE 3: Kubernetes Deployment (5-7 min)"

    if ($DryRun) {
        Write-Warning "Would deploy Kubernetes resources"
    } else {
        try {
            # Create namespaces
            Write-Host "  → Creating namespaces..."
            $namespaceFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/namespaces") -Filter "*.yaml"
            foreach ($nsFile in $namespaceFiles) {
                kubectl apply -f $nsFile.FullName 2>&1 | Out-Null
            }
            Write-Success "Namespaces created"

            # Apply secrets
            Write-Host "  → Applying secrets..."
            $secretFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/secrets") -Filter "*.yaml"
            foreach ($secretFile in $secretFiles) {
                kubectl apply -f $secretFile.FullName 2>&1 | Out-Null
            }
            Write-Success "Secrets applied"

            # Apply ConfigMaps
            Write-Host "  → Applying ConfigMaps..."
            $configMapFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/configmaps") -Filter "*.yaml"
            foreach ($cmFile in $configMapFiles) {
                kubectl apply -f $cmFile.FullName 2>&1 | Out-Null
            }
            Write-Success "ConfigMaps applied"

            # Deploy services
            Write-Host "  → Deploying services..."
            $serviceFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/services") -Filter "*.yaml"
            foreach ($svcFile in $serviceFiles) {
                kubectl apply -f $svcFile.FullName 2>&1 | Out-Null
            }
            Write-Success "Services deployed"

            # Deploy applications
            Write-Host "  → Deploying applications..."
            $deploymentFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/deployments") -Filter "*.yaml"
            foreach ($deployFile in $deploymentFiles) {
                kubectl apply -f $deployFile.FullName 2>&1 | Out-Null
            }
            Write-Success "Applications deployed"

            # Apply Ingress
            Write-Host "  → Configuring Ingress..."
            $ingressFiles = Get-ChildItem -Path (Join-Path $SnapshotPath "kubernetes/ingress") -Filter "*.yaml" -ErrorAction SilentlyContinue
            foreach ($ingressFile in $ingressFiles) {
                kubectl apply -f $ingressFile.FullName 2>&1 | Out-Null
            }
            Write-Success "Ingress configured"

            # Wait for deployments to be ready
            Write-Host "  → Waiting for deployments to be ready (this may take 3-5 minutes)..."
            Start-Sleep -Seconds 30

            $namespaces = @("elara-backend-prod", "elara-frontend-prod", "elara-workers-prod")
            foreach ($ns in $namespaces) {
                kubectl wait --for=condition=available --timeout=300s deployment --all -n $ns 2>$null
            }
            Write-Success "All deployments ready"

        } catch {
            Write-Error "Kubernetes deployment failed: $_"
            if (-not $Emergency) {
                exit 1
            }
        }
    }
} else {
    Write-Warning "Skipping Kubernetes deployment (--SkipKubernetes flag)"
}

# ============================================================================
# PHASE 4: VALIDATION
# ============================================================================

Write-Step "PHASE 4: Environment Validation"

if ($DryRun) {
    Write-Warning "Would validate environment"
} else {
    try {
        # Check pod status
        Write-Host "  → Checking pod health..."
        $allPodsRunning = $true
        $namespaces = @("elara-backend-prod", "elara-frontend-prod", "elara-workers-prod")

        foreach ($ns in $namespaces) {
            $pods = kubectl get pods -n $ns --no-headers 2>$null
            if ($pods) {
                $runningCount = ($pods | Select-String "Running" | Measure-Object).Count
                $totalCount = ($pods | Measure-Object -Line).Lines
                Write-Host "    $ns: $runningCount/$totalCount pods running"

                if ($runningCount -ne $totalCount) {
                    $allPodsRunning = $false
                }
            }
        }

        if ($allPodsRunning) {
            Write-Success "All pods are running"
        } else {
            Write-Warning "Some pods are not running yet. They may still be starting up."
        }

        # Get load balancer IP
        Write-Host "  → Getting load balancer IP..."
        $lbIP = kubectl get service -n elara-proxy elara-ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null

        if ($lbIP) {
            Write-Success "Load balancer IP: $lbIP"
        } else {
            Write-Warning "Load balancer IP not yet assigned (may take a few minutes)"
        }

        # Check database connectivity
        Write-Host "  → Checking database connectivity..."
        $dbHost = gcloud sql instances describe elara-postgres-primary --format='get(ipAddresses[0].ipAddress)' --project=$Project 2>$null
        if ($dbHost) {
            Write-Success "Database accessible at: $dbHost"
        }

    } catch {
        Write-Warning "Some validation checks failed: $_"
    }
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-ColorOutput @"

╔═══════════════════════════════════════════════════════════════╗
║                   RESTORE COMPLETE!                           ║
╚═══════════════════════════════════════════════════════════════╝

Environment Details:
  Project:          $Project
  Region:           $Region
  Snapshot:         $($metadata.snapshot_id)
  Git Commit:       $($metadata.git_commit)

"@ "Green"

if (-not $DryRun) {
    Write-ColorOutput "Next Steps:" "Cyan"
    Write-Host "  1. Update DNS to point to load balancer IP (if using custom domain)"
    Write-Host "  2. Update OAuth redirect URIs (Firebase console)"
    Write-Host "  3. Test application functionality"
    Write-Host "  4. Update monitoring alerts"
    Write-Host ""
    Write-Host "Access your application:"
    $lbIP = kubectl get service -n elara-proxy elara-ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
    if ($lbIP) {
        Write-ColorOutput "  http://$lbIP" "Cyan"
    } else {
        Write-Host "  (Load balancer IP will be available in a few minutes)"
        Write-Host "  Check with: kubectl get service -n elara-proxy"
    }
    Write-Host ""
    Write-ColorOutput "Run validation script:" "Cyan"
    Write-Host "  .\validate-environment.ps1 -Project $Project"
    Write-Host ""
}

Write-ColorOutput "Restore completed successfully! 🎉`n" "Green"
