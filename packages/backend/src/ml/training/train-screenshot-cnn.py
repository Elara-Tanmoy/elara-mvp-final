"""
Vertex AI Training Script: Screenshot CNN Model
Trains EfficientNet/ViT for screenshot-based phishing detection
Per Architecture: Stage-2 Model
"""

import os
import json
import argparse
import pandas as pd
import tensorflow as tf
from google.cloud import bigquery, aiplatform, storage
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras import layers, models
import numpy as np

# Configuration
PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'elara-mvp-13082025-u1')
LOCATION = os.getenv('GCP_LOCATION', 'us-central1')
DATASET_ID = 'elara_training_data_v2'
MODEL_NAME = 'screenshot-cnn'
IMG_SIZE = (224, 224)

def load_screenshot_data():
    """Load screenshot paths from BigQuery"""
    client = bigquery.Client(project=PROJECT_ID)

    query = f"""
    SELECT
        sf.screenshot_path,
        CASE
            WHEN p.url IS NOT NULL THEN 1
            WHEN b.url IS NOT NULL THEN 0
        END as label
    FROM `{PROJECT_ID}.{DATASET_ID}.scan_features` sf
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.phishing_urls` p ON sf.url = p.url
    LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.benign_urls` b ON sf.url = b.url
    WHERE sf.screenshot_path IS NOT NULL
    LIMIT 100000
    """

    df = client.query(query).to_dataframe()
    print(f"Loaded {len(df)} screenshot samples")
    return df

def load_and_preprocess_image(path):
    """Load and preprocess screenshot from GCS"""
    storage_client = storage.Client()

    # Parse GCS path
    if path.startswith('gs://'):
        parts = path.replace('gs://', '').split('/', 1)
        bucket_name = parts[0]
        blob_name = parts[1]

        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)

        # Download to memory
        image_data = blob.download_as_bytes()

        # Decode and resize
        img = tf.image.decode_image(image_data, channels=3)
        img = tf.image.resize(img, IMG_SIZE)
        img = tf.keras.applications.efficientnet.preprocess_input(img)

        return img
    return None

def create_model():
    """Create EfficientNet-based screenshot classifier"""
    base_model = EfficientNetB0(
        include_top=False,
        weights='imagenet',
        input_shape=(*IMG_SIZE, 3)
    )

    # Freeze base model
    base_model.trainable = False

    # Add classification head
    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(2, activation='softmax')  # Binary classification
    ])

    return model

def train_model(args):
    """Main training function"""
    print("=" * 70)
    print(f"Training {MODEL_NAME}")
    print("=" * 70)

    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    # Load data
    print("\n1. Loading screenshot paths...")
    df = load_screenshot_data()

    from sklearn.model_selection import train_test_split
    train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['label'])

    # Create data generators
    print("\n2. Creating data generators...")

    def data_generator(dataframe, batch_size):
        """Generator for loading images on-the-fly"""
        while True:
            for start in range(0, len(dataframe), batch_size):
                end = min(start + batch_size, len(dataframe))
                batch_df = dataframe.iloc[start:end]

                images = []
                labels = []

                for _, row in batch_df.iterrows():
                    try:
                        img = load_and_preprocess_image(row['screenshot_path'])
                        if img is not None:
                            images.append(img)
                            labels.append(row['label'])
                    except Exception as e:
                        print(f"Error loading {row['screenshot_path']}: {e}")
                        continue

                if len(images) > 0:
                    yield np.array(images), np.array(labels)

    # Create model
    print("\n3. Creating model...")
    model = create_model()

    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )

    # Train
    print("\n4. Training model...")
    steps_per_epoch = len(train_df) // args.batch_size
    validation_steps = len(val_df) // args.batch_size

    history = model.fit(
        data_generator(train_df, args.batch_size),
        steps_per_epoch=steps_per_epoch,
        validation_data=data_generator(val_df, args.batch_size),
        validation_steps=validation_steps,
        epochs=args.epochs,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(factor=0.2, patience=2)
        ]
    )

    # Save
    print("\n5. Saving model...")
    model_dir = f"gs://{PROJECT_ID}-training-data/models/{MODEL_NAME}/{args.version}"
    model.save(model_dir)

    # Register
    print("\n6. Registering in Vertex AI...")
    vertex_model = aiplatform.Model.upload(
        display_name=f"{MODEL_NAME}-{args.version}",
        artifact_uri=model_dir,
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/tf2-gpu.2-11:latest",
        description=f"Screenshot-based phishing detection - v{args.version}"
    )

    print(f"\n✅ Model registered: {vertex_model.resource_name}")
    return vertex_model

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=10)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--learning-rate', type=float, default=1e-4)
    parser.add_argument('--version', type=str, default='v1')

    args = parser.parse_args()
    train_model(args)
