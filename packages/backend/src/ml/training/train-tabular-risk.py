"""
Vertex AI Training Script: Tabular Risk Model
Trains XGBoost model for tabular features + TI signals
Per Architecture: Stage-1 Model
"""

import os
import json
import argparse
import pandas as pd
import numpy as np
from google.cloud import bigquery, aiplatform, storage
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'elara-mvp-13082025-u1')
LOCATION = os.getenv('GCP_LOCATION', 'us-central1')
DATASET_ID = 'elara_training_data_v2'
MODEL_NAME = 'tabular-risk'

# Feature columns per architecture
TABULAR_FEATURES = [
    'domain_age_days',
    'tls_valid',
    'tls_days_until_expiry',
    'dns_record_count',
    'subdomain_count',
    'url_length',
    'domain_length',
    'path_length',
    'query_param_count',
    'suspicious_tld',
    'has_ip_address',
    'entropy',
    'digit_ratio',
    'special_char_ratio',
    'ti_total_hits',
    'ti_tier1_hits',
    'ti_tier2_hits',
    'asn_reputation_score',
    'hosting_provider_risk',
    'whois_privacy_enabled',
    'domain_recently_registered',
    'certificate_transparency_logs',
    'redirect_count',
    'form_count',
    'input_field_count',
    'external_resource_count'
]

def load_training_data():
    """Load features from BigQuery"""
    client = bigquery.Client(project=PROJECT_ID)

    query = f"""
    SELECT
        sf.*,
        CASE
            WHEN p.url IS NOT NULL THEN 1
            WHEN b.url IS NOT NULL THEN 0
        END as label
    FROM `{PROJECT_ID}.{DATASET_ID}.scan_features` sf
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.phishing_urls` p ON sf.url = p.url
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.benign_urls` b ON sf.url = b.url
    WHERE sf.url IS NOT NULL
    LIMIT 200000
    """

    df = client.query(query).to_dataframe()
    print(f"Loaded {len(df)} feature samples")
    return df

def prepare_features(df):
    """Prepare feature matrix"""
    # Handle missing values
    df = df.fillna(0)

    # Select features
    available_features = [f for f in TABULAR_FEATURES if f in df.columns]
    X = df[available_features].values
    y = df['label'].values

    print(f"Feature matrix: {X.shape}")
    print(f"Features used: {len(available_features)}/{len(TABULAR_FEATURES)}")

    return X, y, available_features

def train_model(args):
    """Main training function"""
    print("=" * 70)
    print(f"Training {MODEL_NAME}")
    print("=" * 70)

    # Initialize Vertex AI
    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    # Load data
    print("\n1. Loading training data from BigQuery...")
    df = load_training_data()

    # Prepare features
    print("\n2. Preparing features...")
    X, y, feature_names = prepare_features(df)

    # Split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Create DMatrix
    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=feature_names)

    # XGBoost parameters (monotonic constraints for interpretability)
    params = {
        'objective': 'binary:logistic',
        'eval_metric': ['logloss', 'auc'],
        'max_depth': args.max_depth,
        'learning_rate': args.learning_rate,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'min_child_weight': 1,
        'gamma': 0.1,
        'monotone_constraints': '(1,1,-1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,-1,-1,1,1,1,1,1,1,1)',  # Ensure sensible monotonicity
        'seed': 42
    }

    # Train
    print("\n3. Training XGBoost model...")
    evals = [(dtrain, 'train'), (dval, 'val')]
    bst = xgb.train(
        params,
        dtrain,
        num_boost_round=args.num_rounds,
        evals=evals,
        early_stopping_rounds=50,
        verbose_eval=10
    )

    # Evaluate
    print("\n4. Evaluating model...")
    y_pred_proba = bst.predict(dval)
    y_pred = (y_pred_proba > 0.5).astype(int)

    print("\nClassification Report:")
    print(classification_report(y_val, y_pred))
    print(f"\nROC AUC: {roc_auc_score(y_val, y_pred_proba):.4f}")

    # Feature importance
    importance = bst.get_score(importance_type='gain')
    print("\nTop 10 Important Features:")
    sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
    for feat, score in sorted_importance:
        print(f"  {feat}: {score:.2f}")

    # Save model
    print("\n5. Saving model to GCS...")
    model_dir = f"/tmp/{MODEL_NAME}"
    os.makedirs(model_dir, exist_ok=True)

    # Save XGBoost model
    model_path = f"{model_dir}/model.json"
    bst.save_model(model_path)

    # Save feature names and metadata
    metadata = {
        'feature_names': feature_names,
        'model_type': 'xgboost',
        'version': args.version,
        'params': params
    }
    with open(f"{model_dir}/metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)

    # Upload to GCS
    storage_client = storage.Client()
    bucket = storage_client.bucket(f"{PROJECT_ID}-training-data")

    for file_name in ['model.json', 'metadata.json']:
        blob = bucket.blob(f"models/{MODEL_NAME}/{args.version}/{file_name}")
        blob.upload_from_filename(f"{model_dir}/{file_name}")

    model_uri = f"gs://{PROJECT_ID}-training-data/models/{MODEL_NAME}/{args.version}"

    # Register in Vertex AI
    print("\n6. Registering model in Vertex AI...")
    vertex_model = aiplatform.Model.upload(
        display_name=f"{MODEL_NAME}-{args.version}",
        artifact_uri=model_uri,
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/xgboost-cpu.1-6:latest",
        description=f"Tabular risk model with TI signals - v{args.version}"
    )

    print(f"\n✅ Model registered: {vertex_model.resource_name}")

    return vertex_model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--num-rounds', type=int, default=1000)
    parser.add_argument('--max-depth', type=int, default=6)
    parser.add_argument('--learning-rate', type=float, default=0.1)
    parser.add_argument('--version', type=str, default='v1')

    args = parser.parse_args()
    train_model(args)
