#!/bin/bash

###############################################################################
# Elara V2 Training Data Bootstrap Script
#
# Downloads and loads initial training data from public sources:
# - PhishTank (phishing URLs)
# - URLhaus (malicious URLs)
# - Tranco Top 1M (benign URLs)
#
# Usage: ./scripts/bootstrap-training-data.sh
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-elara-mvp}"
DATASET_NAME="elara_training_data_v2"
TEMP_DIR="/tmp/elara-training-data"

echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}  Elara V2 Training Data Bootstrap${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "Project ID:     ${YELLOW}${PROJECT_ID}${NC}"
echo -e "Dataset:        ${YELLOW}${DATASET_NAME}${NC}"
echo -e "Temp directory: ${YELLOW}${TEMP_DIR}${NC}"
echo ""

# Create temp directory
mkdir -p ${TEMP_DIR}
cd ${TEMP_DIR}

###############################################################################
# 1. Download PhishTank Data
###############################################################################

echo -e "\n${GREEN}[1/4] Downloading PhishTank phishing URLs...${NC}"

# PhishTank requires API key, using online-valid CSV
wget -O phishtank.csv "http://data.phishtank.com/data/online-valid.csv" || \
  echo -e "${YELLOW}Warning: PhishTank download failed (may require API key)${NC}"

if [ -f phishtank.csv ]; then
  # Transform to our schema: url, label, confidence, source, timestamp
  echo "Transforming PhishTank data..."
  cat phishtank.csv | tail -n +2 | awk -F',' '{print $2",phishing,1.0,PhishTank," $6}' > phishtank_transformed.csv

  # Load to BigQuery
  echo "Loading to BigQuery..."
  bq load --autodetect --skip_leading_rows=0 --source_format=CSV \
    ${DATASET_NAME}.phishing_urls \
    phishtank_transformed.csv \
    url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP

  PHISHTANK_COUNT=$(wc -l < phishtank_transformed.csv)
  echo -e "${GREEN}✓ Loaded ${PHISHTANK_COUNT} PhishTank URLs${NC}"
else
  echo -e "${YELLOW}⚠ Skipped PhishTank (download failed)${NC}"
fi

###############################################################################
# 2. Download URLhaus Data
###############################################################################

echo -e "\n${GREEN}[2/4] Downloading URLhaus malicious URLs...${NC}"

wget -O urlhaus.csv "https://urlhaus.abuse.ch/downloads/csv_recent/" || \
  echo -e "${YELLOW}Warning: URLhaus download failed${NC}"

if [ -f urlhaus.csv ]; then
  # Transform to our schema
  echo "Transforming URLhaus data..."
  cat urlhaus.csv | grep -v '^#' | tail -n +2 | awk -F',' '{print $3",phishing,0.9,URLhaus," $2}' > urlhaus_transformed.csv

  # Load to BigQuery
  echo "Loading to BigQuery..."
  bq load --autodetect --skip_leading_rows=0 --source_format=CSV \
    ${DATASET_NAME}.phishing_urls \
    urlhaus_transformed.csv \
    url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP

  URLHAUS_COUNT=$(wc -l < urlhaus_transformed.csv)
  echo -e "${GREEN}✓ Loaded ${URLHAUS_COUNT} URLhaus URLs${NC}"
else
  echo -e "${YELLOW}⚠ Skipped URLhaus (download failed)${NC}"
fi

###############################################################################
# 3. Download Tranco Top 1M (Benign URLs)
###############################################################################

echo -e "\n${GREEN}[3/4] Downloading Tranco Top 1M (benign URLs)...${NC}"

wget -O tranco.zip "https://tranco-list.eu/top-1m.csv.zip" || \
  echo -e "${YELLOW}Warning: Tranco download failed${NC}"

if [ -f tranco.zip ]; then
  unzip -o tranco.zip

  # Take top 100K for training (balance with phishing URLs)
  echo "Transforming Tranco data (top 100K)..."
  head -n 100000 top-1m.csv | awk -F',' '{print "https://" $2 ",benign,1.0,Tranco," strftime("%Y-%m-%d %H:%M:%S", systime())}' > tranco_transformed.csv

  # Load to BigQuery
  echo "Loading to BigQuery..."
  bq load --autodetect --skip_leading_rows=0 --source_format=CSV \
    ${DATASET_NAME}.benign_urls \
    tranco_transformed.csv \
    url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:STRING

  TRANCO_COUNT=$(wc -l < tranco_transformed.csv)
  echo -e "${GREEN}✓ Loaded ${TRANCO_COUNT} Tranco benign URLs${NC}"
else
  echo -e "${YELLOW}⚠ Skipped Tranco (download failed)${NC}"
fi

###############################################################################
# 4. Load V1 Pseudo-Labels (Optional)
###############################################################################

echo -e "\n${GREEN}[4/4] Extracting V1 pseudo-labels from scan history...${NC}"

# This requires access to Elara's scan_results table
# We'll create a SQL query to extract high-confidence V1 scans

cat > v1_pseudo_labels.sql <<EOF
SELECT
  targetUrl as url,
  CASE
    WHEN riskLevel IN ('E', 'F') THEN 'phishing'
    WHEN riskLevel IN ('A', 'B') THEN 'benign'
    ELSE 'suspicious'
  END as label,
  CASE
    WHEN riskLevel IN ('A', 'F') THEN 0.9
    WHEN riskLevel IN ('B', 'E') THEN 0.7
    ELSE 0.5
  END as confidence,
  'v1-pseudo' as source,
  createdAt as timestamp
FROM \`${PROJECT_ID}.elara.ScanResult\`
WHERE
  scanType = 'url'
  AND riskLevel IS NOT NULL
  AND createdAt > DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
  AND riskLevel IN ('A', 'B', 'E', 'F')
LIMIT 50000
EOF

echo "Running V1 pseudo-label extraction query..."
bq query --use_legacy_sql=false --format=csv < v1_pseudo_labels.sql > v1_pseudo.csv 2>/dev/null || \
  echo -e "${YELLOW}⚠ V1 pseudo-label extraction failed (scan_results table may not exist)${NC}"

if [ -f v1_pseudo.csv ] && [ $(wc -l < v1_pseudo.csv) -gt 1 ]; then
  # Load to appropriate tables based on label
  echo "Loading V1 pseudo-labels..."
  tail -n +2 v1_pseudo.csv | grep ',phishing,' > v1_phishing.csv 2>/dev/null || true
  tail -n +2 v1_pseudo.csv | grep ',benign,' > v1_benign.csv 2>/dev/null || true

  if [ -f v1_phishing.csv ] && [ -s v1_phishing.csv ]; then
    bq load --autodetect --skip_leading_rows=0 --source_format=CSV \
      ${DATASET_NAME}.phishing_urls \
      v1_phishing.csv \
      url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP

    V1_PHISH_COUNT=$(wc -l < v1_phishing.csv)
    echo -e "${GREEN}✓ Loaded ${V1_PHISH_COUNT} V1 pseudo-labeled phishing URLs${NC}"
  fi

  if [ -f v1_benign.csv ] && [ -s v1_benign.csv ]; then
    bq load --autodetect --skip_leading_rows=0 --source_format=CSV \
      ${DATASET_NAME}.benign_urls \
      v1_benign.csv \
      url:STRING,label:STRING,confidence:FLOAT,source:STRING,timestamp:TIMESTAMP

    V1_BENIGN_COUNT=$(wc -l < v1_benign.csv)
    echo -e "${GREEN}✓ Loaded ${V1_BENIGN_COUNT} V1 pseudo-labeled benign URLs${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Skipped V1 pseudo-labels (no data available)${NC}"
fi

###############################################################################
# Summary
###############################################################################

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}  Bootstrap Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo "Training data loaded:"
echo "  ✓ PhishTank: ${PHISHTANK_COUNT:-0} phishing URLs"
echo "  ✓ URLhaus: ${URLHAUS_COUNT:-0} phishing URLs"
echo "  ✓ Tranco: ${TRANCO_COUNT:-0} benign URLs"
echo "  ✓ V1 Pseudo: ${V1_PHISH_COUNT:-0} phishing + ${V1_BENIGN_COUNT:-0} benign"
echo ""
echo "Total records:"
TOTAL_PHISHING=$((${PHISHTANK_COUNT:-0} + ${URLHAUS_COUNT:-0} + ${V1_PHISH_COUNT:-0}))
TOTAL_BENIGN=$((${TRANCO_COUNT:-0} + ${V1_BENIGN_COUNT:-0}))
TOTAL=$((${TOTAL_PHISHING} + ${TOTAL_BENIGN}))
echo "  • Phishing: ${TOTAL_PHISHING}"
echo "  • Benign: ${TOTAL_BENIGN}"
echo "  • Total: ${TOTAL}"
echo ""
echo "Next steps:"
echo "  1. Verify data in BigQuery console"
echo "  2. Run training pipeline to train V2 models"
echo "  3. Deploy models to Vertex AI"
echo ""

# Cleanup
cd -
rm -rf ${TEMP_DIR}

echo -e "${GREEN}Training data bootstrap complete!${NC}"
