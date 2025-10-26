"""
Vertex AI Training Script: Text Persuasion Model
Trains Gemma/Mixtral for persuasion/social engineering detection
Per Architecture: Stage-2 Model
"""

import os
import json
import argparse
import pandas as pd
from google.cloud import bigquery, aiplatform
import tensorflow as tf
from transformers import AutoTokenizer, TFAutoModelForSequenceClassification, create_optimizer

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'elara-mvp-13082025-u1')
LOCATION = os.getenv('GCP_LOCATION', 'us-central1')
DATASET_ID = 'elara_training_data_v2'
MODEL_NAME = 'text-persuasion'
BASE_MODEL = 'distilbert-base-uncased'  # Can upgrade to Gemma/Mixtral

def load_training_data():
    """Load text content from scan_features"""
    client = bigquery.Client(project=PROJECT_ID)

    query = f"""
    SELECT
        sf.extracted_text,
        CASE
            WHEN p.url IS NOT NULL THEN 1
            WHEN b.url IS NOT NULL THEN 0
        END as label
    FROM `{PROJECT_ID}.{DATASET_ID}.scan_features` sf
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.phishing_urls` p ON sf.url = p.url
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.benign_urls` b ON sf.url = b.url
    WHERE sf.extracted_text IS NOT NULL AND LENGTH(sf.extracted_text) > 50
    LIMIT 150000
    """

    df = client.query(query).to_dataframe()
    print(f"Loaded {len(df)} text samples")
    return df

def train_model(args):
    """Main training function"""
    print("=" * 70)
    print(f"Training {MODEL_NAME}")
    print("=" * 70)

    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    # Load data
    print("\n1. Loading training data...")
    df = load_training_data()

    from sklearn.model_selection import train_test_split
    train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['label'])

    # Tokenizer
    print("\n2. Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    # Tokenize
    print("\n3. Tokenizing text...")
    train_encodings = tokenizer(
        train_df['extracted_text'].tolist(),
        max_length=args.max_length,
        padding='max_length',
        truncation=True,
        return_tensors='tf'
    )

    val_encodings = tokenizer(
        val_df['extracted_text'].tolist(),
        max_length=args.max_length,
        padding='max_length',
        truncation=True,
        return_tensors='tf'
    )

    # Datasets
    train_dataset = tf.data.Dataset.from_tensor_slices((
        dict(train_encodings),
        train_df['label'].values
    )).shuffle(1000).batch(args.batch_size)

    val_dataset = tf.data.Dataset.from_tensor_slices((
        dict(val_encodings),
        val_df['label'].values
    )).batch(args.batch_size)

    # Model
    print("\n4. Creating model...")
    model = TFAutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=2)

    # Optimizer
    num_train_steps = len(train_df) // args.batch_size * args.epochs
    optimizer, _ = create_optimizer(
        init_lr=args.learning_rate,
        num_train_steps=num_train_steps,
        num_warmup_steps=num_train_steps // 10
    )

    model.compile(
        optimizer=optimizer,
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=['accuracy']
    )

    # Train
    print("\n5. Training...")
    history = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=args.epochs,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=2, restore_best_weights=True)]
    )

    # Save
    print("\n6. Saving model...")
    model_dir = f"gs://{PROJECT_ID}-training-data/models/{MODEL_NAME}/{args.version}"
    model.save_pretrained(model_dir)
    tokenizer.save_pretrained(model_dir)

    # Register
    print("\n7. Registering in Vertex AI...")
    vertex_model = aiplatform.Model.upload(
        display_name=f"{MODEL_NAME}-{args.version}",
        artifact_uri=model_dir,
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/tf2-gpu.2-11:latest",
        description=f"Text persuasion detection model - v{args.version}"
    )

    print(f"\n✅ Model registered: {vertex_model.resource_name}")
    return vertex_model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=3)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--learning-rate', type=float, default=2e-5)
    parser.add_argument('--max-length', type=int, default=512)
    parser.add_argument('--version', type=str, default='v1')

    args = parser.parse_args()
    train_model(args)
