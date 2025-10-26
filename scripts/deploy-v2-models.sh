#!/bin/bash

#################################################################
# Elara V2 - Deploy Trained Models to Vertex AI Endpoints
#
# Deploys all 5 V2 models to Vertex AI prediction endpoints
# Per Architecture: Stage-1 (CPU), Stage-2 (GPU), Combiner (CPU)
#################################################################

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-elara-mvp-13082025-u1}"
LOCATION="${GCP_LOCATION:-us-central1}"
MODEL_VERSION="${MODEL_VERSION:-v1}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================================="
echo "Elara V2 - Deploy Models to Vertex AI Endpoints"
echo -e "==================================================================${NC}"
echo ""
echo "Project ID:     ${GREEN}${PROJECT_ID}${NC}"
echo "Location:       ${GREEN}${LOCATION}${NC}"
echo "Model Version:  ${GREEN}${MODEL_VERSION}${NC}"
echo ""

# Function to deploy model to endpoint
deploy_model() {
    local model_name=$1
    local machine_type=$2
    local min_replicas=${3:-1}
    local max_replicas=${4:-3}

    echo -e "${BLUE}[1/4] Finding model ${model_name}-${MODEL_VERSION}...${NC}"

    # Find model ID
    model_id=$(gcloud ai models list \
        --project=${PROJECT_ID} \
        --region=${LOCATION} \
        --filter="displayName:${model_name}-${MODEL_VERSION}" \
        --format="value(name)" \
        --limit=1)

    if [ -z "$model_id" ]; then
        echo -e "${RED}Error: Model ${model_name}-${MODEL_VERSION} not found${NC}"
        echo "Please train the model first using the training scripts"
        return 1
    fi

    echo -e "${GREEN}✓ Found model: ${model_id}${NC}"

    # Check if endpoint exists
    echo -e "${BLUE}[2/4] Checking if endpoint exists...${NC}"

    endpoint_id=$(gcloud ai endpoints list \
        --project=${PROJECT_ID} \
        --region=${LOCATION} \
        --filter="displayName:${model_name}-endpoint" \
        --format="value(name)" \
        --limit=1)

    if [ -z "$endpoint_id" ]; then
        echo -e "${YELLOW}Creating new endpoint for ${model_name}...${NC}"
        gcloud ai endpoints create \
            --project=${PROJECT_ID} \
            --region=${LOCATION} \
            --display-name="${model_name}-endpoint"

        endpoint_id=$(gcloud ai endpoints list \
            --project=${PROJECT_ID} \
            --region=${LOCATION} \
            --filter="displayName:${model_name}-endpoint" \
            --format="value(name)" \
            --limit=1)

        echo -e "${GREEN}✓ Endpoint created: ${endpoint_id}${NC}"
    else
        echo -e "${GREEN}✓ Using existing endpoint: ${endpoint_id}${NC}"
    fi

    # Deploy model to endpoint
    echo -e "${BLUE}[3/4] Deploying model to endpoint...${NC}"

    gcloud ai endpoints deploy-model ${endpoint_id} \
        --project=${PROJECT_ID} \
        --region=${LOCATION} \
        --model=${model_id} \
        --display-name="${model_name}-deployment-${MODEL_VERSION}" \
        --machine-type=${machine_type} \
        --min-replica-count=${min_replicas} \
        --max-replica-count=${max_replicas} \
        --traffic-split=0=100

    echo -e "${GREEN}✓ Model deployed successfully${NC}"

    # Get endpoint URI
    endpoint_uri="https://${LOCATION}-aiplatform.googleapis.com/v1/${endpoint_id}:predict"

    echo -e "${BLUE}[4/4] Endpoint Details:${NC}"
    echo "  Endpoint ID: ${endpoint_id}"
    echo "  Endpoint URI: ${endpoint_uri}"
    echo ""

    # Save endpoint to environment variable format
    echo "VERTEX_$(echo ${model_name} | tr '[:lower:]-' '[:upper:]_')_ENDPOINT=${endpoint_id}" >> /tmp/v2-endpoints.env

    return 0
}

# Main deployment process
echo -e "${BLUE}=================================================================="
echo "Deploying V2 Models"
echo -e "==================================================================${NC}"
echo ""

# Clear previous endpoints file
> /tmp/v2-endpoints.env

# Deploy Stage-1 Models (CPU)
echo -e "${YELLOW}[Stage-1 Models - CPU]${NC}"
echo ""

deploy_model "url-lexical-bert" "n1-standard-4" 1 3
deploy_model "tabular-risk" "n1-standard-2" 1 2

echo ""

# Deploy Stage-2 Models (GPU)
echo -e "${YELLOW}[Stage-2 Models - GPU]${NC}"
echo ""

deploy_model "text-persuasion" "n1-standard-4" 1 2  # Can use GPU: "n1-standard-4-nvidia-tesla-t4"
deploy_model "screenshot-cnn" "n1-standard-4" 1 2   # Can use GPU: "n1-standard-4-nvidia-tesla-t4"

echo ""

# Deploy Combiner Model (CPU)
echo -e "${YELLOW}[Combiner Model - CPU]${NC}"
echo ""

deploy_model "combiner" "n1-standard-2" 1 2

echo ""
echo -e "${GREEN}=================================================================="
echo "✅ All V2 Models Deployed Successfully!"
echo -e "==================================================================${NC}"
echo ""
echo "Endpoint environment variables saved to: /tmp/v2-endpoints.env"
echo ""
echo "Add these to your backend environment:"
echo -e "${BLUE}$(cat /tmp/v2-endpoints.env)${NC}"
echo ""
echo "Next steps:"
echo "  1. Add endpoint IDs to Secret Manager or Kubernetes secrets"
echo "  2. Update backend deployment to include endpoint variables"
echo "  3. Test V2 scanner with real models"
echo ""
