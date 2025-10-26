"""
Vertex AI Training Script: Combiner Model
Trains final combiner to fuse Stage-1 and Stage-2 predictions with causal signals
Per Architecture: Combiner + Conformal Calibration
"""

import os
import json
import argparse
import pandas as pd
import numpy as np
from google.cloud import bigquery, aiplatform, storage
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score
import joblib

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'elara-mvp-13082025-u1')
LOCATION = os.getenv('GCP_LOCATION', 'us-central1')
DATASET_ID = 'elara_training_data_v2'
MODEL_NAME = 'combiner'

# Combiner features (outputs from Stage-1 and Stage-2)
COMBINER_FEATURES = [
    'url_lexical_a_prob',      # XGBoost URL model
    'url_lexical_b_prob',      # BERT URL model
    'tabular_risk_prob',       # Tabular risk model
    'text_persuasion_prob',    # Text analysis (Stage-2)
    'screenshot_cnn_prob',     # Screenshot CNN (Stage-2)
    # Causal signals
    'form_origin_mismatch',
    'brand_infra_divergence',
    'redirect_homoglyph_delta',
    'auto_download',
    'domain_age_young',
    'ti_dual_tier1_hits',
    # Reachability context
    'reachability_online',
    'reachability_offline',
    'reachability_waf'
]

def load_combiner_data():
    """Load combined predictions from BigQuery"""
    client = bigquery.Client(project=PROJECT_ID)

    # This would load historical V2 scan results with all model outputs
    query = f"""
    SELECT
        *,
        CASE
            WHEN p.url IS NOT NULL THEN 1
            WHEN b.url IS NOT NULL THEN 0
        END as label
    FROM `{PROJECT_ID}.{DATASET_ID}.combiner_training_data`
    WHERE url IS NOT NULL
    LIMIT 100000
    """

    try:
        df = client.query(query).to_dataframe()
    except:
        # Fallback: generate synthetic data for initial training
        print("Warning: No combiner training data found. Generating synthetic data...")
        df = generate_synthetic_combiner_data(10000)

    print(f"Loaded {len(df)} combiner training samples")
    return df

def generate_synthetic_combiner_data(n_samples):
    """Generate synthetic combiner training data"""
    np.random.seed(42)

    # Malicious samples (label=1)
    n_malicious = n_samples // 2
    malicious_data = {
        'url_lexical_a_prob': np.random.beta(8, 2, n_malicious),
        'url_lexical_b_prob': np.random.beta(8, 2, n_malicious),
        'tabular_risk_prob': np.random.beta(7, 3, n_malicious),
        'text_persuasion_prob': np.random.beta(7, 3, n_malicious),
        'screenshot_cnn_prob': np.random.beta(6, 4, n_malicious),
        'form_origin_mismatch': np.random.binomial(1, 0.7, n_malicious),
        'brand_infra_divergence': np.random.binomial(1, 0.6, n_malicious),
        'redirect_homoglyph_delta': np.random.binomial(1, 0.5, n_malicious),
        'auto_download': np.random.binomial(1, 0.3, n_malicious),
        'domain_age_young': np.random.binomial(1, 0.8, n_malicious),
        'ti_dual_tier1_hits': np.random.binomial(1, 0.4, n_malicious),
        'reachability_online': np.ones(n_malicious),
        'reachability_offline': np.zeros(n_malicious),
        'reachability_waf': np.zeros(n_malicious),
        'label': np.ones(n_malicious)
    }

    # Benign samples (label=0)
    n_benign = n_samples - n_malicious
    benign_data = {
        'url_lexical_a_prob': np.random.beta(2, 8, n_benign),
        'url_lexical_b_prob': np.random.beta(2, 8, n_benign),
        'tabular_risk_prob': np.random.beta(3, 7, n_benign),
        'text_persuasion_prob': np.random.beta(3, 7, n_benign),
        'screenshot_cnn_prob': np.random.beta(4, 6, n_benign),
        'form_origin_mismatch': np.random.binomial(1, 0.1, n_benign),
        'brand_infra_divergence': np.random.binomial(1, 0.2, n_benign),
        'redirect_homoglyph_delta': np.random.binomial(1, 0.1, n_benign),
        'auto_download': np.random.binomial(1, 0.05, n_benign),
        'domain_age_young': np.random.binomial(1, 0.3, n_benign),
        'ti_dual_tier1_hits': np.random.binomial(1, 0.05, n_benign),
        'reachability_online': np.ones(n_benign),
        'reachability_offline': np.zeros(n_benign),
        'reachability_waf': np.zeros(n_benign),
        'label': np.zeros(n_benign)
    }

    df = pd.concat([pd.DataFrame(malicious_data), pd.DataFrame(benign_data)], ignore_index=True)
    return df.sample(frac=1).reset_index(drop=True)

def train_conformal_calibration(X_cal, y_cal, base_model):
    """Train conformal prediction calibration"""
    # Get base model probabilities
    cal_probs = base_model.predict_proba(X_cal)[:, 1]

    # Compute non-conformity scores
    scores = np.abs(cal_probs - y_cal)

    # Store quantiles for different confidence levels
    calibration = {
        'alpha_0.1': np.quantile(scores, 0.9),   # 90% confidence
        'alpha_0.05': np.quantile(scores, 0.95),  # 95% confidence
        'alpha_0.01': np.quantile(scores, 0.99)   # 99% confidence
    }

    return calibration

def train_model(args):
    """Main training function"""
    print("=" * 70)
    print(f"Training {MODEL_NAME}")
    print("=" * 70)

    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    # Load data
    print("\n1. Loading combiner training data...")
    df = load_combiner_data()

    # Prepare features
    print("\n2. Preparing features...")
    X = df[COMBINER_FEATURES].values
    y = df['label'].values

    # Split: train, calibration, validation
    X_train_val, X_test, y_train_val, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    X_train, X_cal, y_train, y_cal = train_test_split(X_train_val, y_train_val, test_size=0.25, random_state=42, stratify=y_train_val)

    # Train combiner model
    print("\n3. Training combiner model...")
    if args.model_type == 'logistic':
        model = LogisticRegression(max_iter=1000, random_state=42)
    else:
        model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.1,
            random_state=42
        )

    model.fit(X_train, y_train)

    # Evaluate
    print("\n4. Evaluating combiner...")
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba > 0.5).astype(int)

    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print(f"\nROC AUC: {roc_auc_score(y_test, y_pred_proba):.4f}")

    # Train conformal calibration
    print("\n5. Training conformal calibration...")
    calibration = train_conformal_calibration(X_cal, y_cal, model)
    print(f"Calibration quantiles: {calibration}")

    # Save model
    print("\n6. Saving model to GCS...")
    model_dir = "/tmp/combiner"
    os.makedirs(model_dir, exist_ok=True)

    # Save combiner model
    joblib.dump(model, f"{model_dir}/model.pkl")

    # Save calibration and metadata
    metadata = {
        'feature_names': COMBINER_FEATURES,
        'model_type': args.model_type,
        'version': args.version,
        'calibration': calibration
    }
    with open(f"{model_dir}/metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)

    # Upload to GCS
    storage_client = storage.Client()
    bucket = storage_client.bucket(f"{PROJECT_ID}-training-data")

    for file_name in ['model.pkl', 'metadata.json']:
        blob = bucket.blob(f"models/{MODEL_NAME}/{args.version}/{file_name}")
        blob.upload_from_filename(f"{model_dir}/{file_name}")

    model_uri = f"gs://{PROJECT_ID}-training-data/models/{MODEL_NAME}/{args.version}"

    # Register in Vertex AI
    print("\n7. Registering model in Vertex AI...")
    vertex_model = aiplatform.Model.upload(
        display_name=f"{MODEL_NAME}-{args.version}",
        artifact_uri=model_uri,
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest",
        description=f"Combiner model with conformal calibration - v{args.version}"
    )

    print(f"\n✅ Model registered: {vertex_model.resource_name}")
    return vertex_model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-type', type=str, default='gbm', choices=['logistic', 'gbm'])
    parser.add_argument('--version', type=str, default='v1')

    args = parser.parse_args()
    train_model(args)
