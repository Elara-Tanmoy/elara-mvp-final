"""
Vertex AI Training Script: URL Lexical BERT Model
Trains PhishBERT/URLBERT transformer for URL maliciousness detection
Per Architecture: Stage-1 Model
"""

import os
import json
import argparse
from google.cloud import bigquery, aiplatform
from google.cloud.aiplatform import gapic
import tensorflow as tf
from transformers import AutoTokenizer, TFAutoModelForSequenceClassification, create_optimizer
import numpy as np

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'elara-mvp-13082025-u1')
LOCATION = os.getenv('GCP_LOCATION', 'us-central1')
DATASET_ID = 'elara_training_data_v2'
MODEL_NAME = 'url-lexical-bert'
BERT_MODEL = 'bert-base-uncased'  # Can use phishbert if available

def load_training_data():
    """Load training data from BigQuery"""
    client = bigquery.Client(project=PROJECT_ID)

    # Query phishing URLs
    phishing_query = f"""
    SELECT url, 1 as label
    FROM `{PROJECT_ID}.{DATASET_ID}.phishing_urls`
    LIMIT 100000
    """

    # Query benign URLs
    benign_query = f"""
    SELECT url, 0 as label
    FROM `{PROJECT_ID}.{DATASET_ID}.benign_urls`
    LIMIT 100000
    """

    phishing_df = client.query(phishing_query).to_dataframe()
    benign_df = client.query(benign_query).to_dataframe()

    # Combine and shuffle
    df = pd.concat([phishing_df, benign_df], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"Loaded {len(df)} training samples")
    print(f"Phishing: {len(phishing_df)}, Benign: {len(benign_df)}")

    return df

def preprocess_urls(urls, tokenizer, max_length=128):
    """Tokenize URLs for BERT"""
    return tokenizer(
        urls.tolist(),
        max_length=max_length,
        padding='max_length',
        truncation=True,
        return_tensors='tf'
    )

def create_model():
    """Create URL BERT classification model"""
    model = TFAutoModelForSequenceClassification.from_pretrained(
        BERT_MODEL,
        num_labels=2  # Binary classification
    )
    return model

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

    # Split train/val
    from sklearn.model_selection import train_test_split
    train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['label'])

    # Load tokenizer
    print("\n2. Loading BERT tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL)

    # Preprocess
    print("\n3. Tokenizing URLs...")
    train_encodings = preprocess_urls(train_df['url'], tokenizer, args.max_length)
    val_encodings = preprocess_urls(val_df['url'], tokenizer, args.max_length)

    # Create TF datasets
    train_dataset = tf.data.Dataset.from_tensor_slices((
        dict(train_encodings),
        train_df['label'].values
    )).shuffle(1000).batch(args.batch_size)

    val_dataset = tf.data.Dataset.from_tensor_slices((
        dict(val_encodings),
        val_df['label'].values
    )).batch(args.batch_size)

    # Create model
    print("\n4. Creating model...")
    model = create_model()

    # Optimizer
    num_train_steps = len(train_df) // args.batch_size * args.epochs
    optimizer, lr_schedule = create_optimizer(
        init_lr=args.learning_rate,
        num_train_steps=num_train_steps,
        num_warmup_steps=num_train_steps // 10
    )

    # Compile
    model.compile(
        optimizer=optimizer,
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=['accuracy']
    )

    # Train
    print("\n5. Training model...")
    history = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=args.epochs,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
            tf.keras.callbacks.ModelCheckpoint(
                filepath=f'/tmp/{MODEL_NAME}_best.h5',
                save_best_only=True
            )
        ]
    )

    # Evaluate
    print("\n6. Evaluating model...")
    results = model.evaluate(val_dataset)
    print(f"Validation Loss: {results[0]:.4f}")
    print(f"Validation Accuracy: {results[1]:.4f}")

    # Save model
    print("\n7. Saving model to GCS...")
    model_dir = f"gs://{PROJECT_ID}-training-data/models/{MODEL_NAME}/{args.version}"
    model.save_pretrained(model_dir)
    tokenizer.save_pretrained(model_dir)

    # Register in Vertex AI Model Registry
    print("\n8. Registering model in Vertex AI...")
    vertex_model = aiplatform.Model.upload(
        display_name=f"{MODEL_NAME}-{args.version}",
        artifact_uri=model_dir,
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/tf2-cpu.2-11:latest",
        description=f"URL Lexical BERT model for phishing detection - v{args.version}"
    )

    print(f"\n✅ Model registered: {vertex_model.resource_name}")
    print(f"Model ID: {vertex_model.name}")

    return vertex_model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=5)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--learning-rate', type=float, default=2e-5)
    parser.add_argument('--max-length', type=int, default=128)
    parser.add_argument('--version', type=str, default='v1')

    args = parser.parse_args()
    train_model(args)
