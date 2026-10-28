"""Train/evaluate the MI-AINA tabular MLP separately from the Django app.

Usage: python ai/train_mlp.py path/to/disease_symptoms_dataset.csv
Review the generated feature report and suspected leakage list before deployment.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             precision_recall_fscore_support, top_k_accuracy_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from tensorflow.keras import Sequential
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.layers import Dense, Dropout, Input
from tensorflow.keras.utils import to_categorical

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
FEATURE_CONFIG = os.path.join(os.path.dirname(__file__), 'clinical_features.json')
TARGET = 'disease'
ID_RE = re.compile(r'(^|_)(id|index|unnamed)(_|$)', re.I)
LEAK_RE = re.compile(r'(diagnos|disease|prognos|treatment|medication|prescription|outcome|target)', re.I)


def main(csv_path):
    frame = pd.read_csv(csv_path)
    if TARGET not in frame:
        raise ValueError("Dataset must contain target column 'disease'.")
    raw_rows = len(frame)
    with open(FEATURE_CONFIG, encoding='utf-8') as f:
        feature_config = json.load(f)
    model_features = feature_config['model_inputs']
    missing_features = [name for name in model_features if name not in frame.columns]
    if missing_features:
        raise ValueError('Dataset is missing configured clinical features: ' + ', '.join(missing_features))
    missing_targets = int(frame[TARGET].isna().sum())
    # Drop IDs before checking duplicates so unique record keys cannot mask repeats.
    id_columns = [c for c in frame if ID_RE.search(str(c))]
    frame = frame.drop(columns=id_columns)
    # Restrict training to fields the MI-AINA form or available sensors can provide.
    frame = frame[model_features + [TARGET]]
    frame = frame.dropna(subset=[TARGET])
    duplicate_clinical_profiles = int(frame.drop(columns=[TARGET]).duplicated().sum())
    frame = frame.drop_duplicates().reset_index(drop=True)
    rows_after_deduplication = len(frame)
    labels = frame.pop(TARGET).astype(str)
    removable = [c for c in frame if frame[c].nunique(dropna=False) <= 1]
    suspected_leakage = [c for c in frame if LEAK_RE.search(str(c)) and c not in removable]
    # Never silently train on likely post-diagnosis fields.
    frame = frame.drop(columns=set(removable + suspected_leakage), errors='ignore')
    if frame.empty:
        raise ValueError('No candidate input features remain after ID/constant/leakage filtering.')
    optional_sensor_features = {'temperature_c', 'heart_rate_bpm', 'oxygen_saturation'}
    minimum_available_features = sum(name not in optional_sensor_features for name in frame.columns)

    encoder = LabelEncoder()
    y = encoder.fit_transform(labels)
    if len(encoder.classes_) < 2:
        raise ValueError('At least two disease classes are required.')
    x_train_raw, x_holdout_raw, y_train, y_holdout = train_test_split(
        frame, y, test_size=0.30, random_state=42, stratify=y)
    x_val_raw, x_test_raw, y_val, y_test = train_test_split(
        x_holdout_raw, y_holdout, test_size=0.50, random_state=42, stratify=y_holdout)
    # Fit category vocabularies and imputers on train only to prevent preprocessing leakage.
    categorical = [c for c in x_train_raw if not pd.api.types.is_numeric_dtype(x_train_raw[c])]
    numeric = [c for c in x_train_raw if c not in categorical]
    categories = {c: sorted(x_train_raw[c].dropna().astype(str).unique().tolist() +
        (['__MISSING__'] if x_train_raw[c].isna().any() else [])) for c in categorical}
    medians = {c: float(pd.to_numeric(x_train_raw[c], errors='coerce').median()) for c in numeric}
    medians = {c: (v if np.isfinite(v) else 0.0) for c, v in medians.items()}

    def encode(part):
        clean = part.copy()
        for column in numeric:
            clean[column] = pd.to_numeric(clean[column], errors='coerce').fillna(medians[column])
        for column in categorical:
            clean[column] = clean[column].astype('string').fillna('__MISSING__')
        values = {column: clean[column].astype(float) for column in numeric}
        for column in categorical:
            for category in categories[column]:
                values[column + '_' + category] = (clean[column].astype(str) == category).astype(float)
        return pd.DataFrame(values, index=clean.index)

    x_train_df, x_val_df, x_test_df = map(encode, (x_train_raw, x_val_raw, x_test_raw))
    transformed_columns = x_train_df.columns.tolist()
    transformed_sources = [[c, None] for c in numeric] + [[c, category]
        for c in categorical for category in categories[c]]
    x_train, x_val, x_test = (part.to_numpy(dtype='float32') for part in
                              (x_train_df, x_val_df, x_test_df))
    numeric_indices = [transformed_columns.index(c) for c in numeric]
    scaler = StandardScaler() if numeric_indices else None
    if scaler:
        x_train[:, numeric_indices] = scaler.fit_transform(x_train[:, numeric_indices])
        x_val[:, numeric_indices] = scaler.transform(x_val[:, numeric_indices])
        x_test[:, numeric_indices] = scaler.transform(x_test[:, numeric_indices])
    x_train = x_train.astype('float32')
    x_val = x_val.astype('float32')
    x_test = x_test.astype('float32')
    y_train_cat = to_categorical(y_train, len(encoder.classes_))
    y_val_cat = to_categorical(y_val, len(encoder.classes_))
    architectures = [(256, 128), (512, 256, 128)]
    best_model, best_val = None, -1.0
    comparisons = []
    for widths in architectures:
        model = Sequential([Input(shape=(x_train.shape[1],))])
        for width in widths:
            model.add(Dense(width, activation='relu'))
            model.add(Dropout(0.35))
        model.add(Dense(len(encoder.classes_), activation='softmax'))
        model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        history = model.fit(x_train, y_train_cat, validation_data=(x_val, y_val_cat),
            epochs=150, batch_size=128, verbose=2,
            callbacks=[EarlyStopping(monitor='val_loss', patience=12, restore_best_weights=True),
                       ReduceLROnPlateau(monitor='val_loss', patience=5, factor=0.5, min_lr=1e-6)])
        val_score = float(max(history.history.get('val_accuracy', [0])))
        comparisons.append({'layers': list(widths), 'best_validation_accuracy': val_score})
        if val_score > best_val:
            best_val, best_model = val_score, model

    test_scores = best_model.predict(x_test, verbose=0)
    predicted = test_scores.argmax(axis=1)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, predicted,
        average='weighted', zero_division=0)
    metrics = {'accuracy': float(accuracy_score(y_test, predicted)),
        'precision_weighted': float(precision), 'recall_weighted': float(recall),
        'f1_weighted': float(f1),
        'top1_accuracy': float(top_k_accuracy_score(y_test, test_scores, k=1, labels=np.arange(len(encoder.classes_)))),
        'top3_accuracy': float(top_k_accuracy_score(y_test, test_scores, k=min(3, len(encoder.classes_)), labels=np.arange(len(encoder.classes_)))),
        'confusion_matrix': confusion_matrix(y_test, predicted).tolist(),
        'classification_report': classification_report(y_test, predicted, target_names=encoder.classes_.tolist(), output_dict=True, zero_division=0)}
    os.makedirs(OUT, exist_ok=True)
    best_model.save(os.path.join(OUT, 'mi_aina_mlp.keras'))
    joblib.dump({'scaler': scaler, 'numeric_indices': numeric_indices}, os.path.join(OUT, 'scaler.pkl'))
    joblib.dump(encoder, os.path.join(OUT, 'label_encoder.pkl'))
    # Deployable schema records source and one-hot column order to prevent drift.
    schema = {'features': frame.columns.tolist(), 'categorical_features': categorical,
        'categories': categories, 'numeric_medians': medians,
        'transformed_features': transformed_columns, 'transformed_sources': transformed_sources}
    with open(os.path.join(OUT, 'selected_features.json'), 'w', encoding='utf-8') as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)
    metadata = {'trained_at': datetime.now(timezone.utc).isoformat(), 'source_rows': raw_rows,
        'rows_after_target_cleanup_and_deduplication': rows_after_deduplication,
        'rows_missing_target': missing_targets, 'duplicate_clinical_profiles': duplicate_clinical_profiles,
        'removed_missing_target_or_duplicate_rows': raw_rows - rows_after_deduplication,
        'class_count': len(encoder.classes_), 'features': len(frame.columns),
        'suspected_leakage_excluded': suspected_leakage, 'identifiers_removed': id_columns,
        'constants_removed': removable,
        'feature_selection_source': 'ai/clinical_features.json',
        'feature_review_required': True,
        'architecture_comparison': comparisons, 'selected_architecture': max(comparisons, key=lambda x:x['best_validation_accuracy'])['layers'],
        'metrics': metrics, 'minimum_available_features': minimum_available_features,
        'minimum_available_features_note': 'Requires all checklist symptoms and patient age/sex; the three sensor features are optional.',
        'optional_sensor_features': sorted(optional_sensor_features)}
    with open(os.path.join(OUT, 'model_metadata.json'), 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(json.dumps({'rows': len(frame), 'candidate_features': frame.columns.tolist(),
        'suspected_leakage_excluded': suspected_leakage, 'metrics': {k:v for k,v in metrics.items() if k != 'confusion_matrix'}}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python ai/train_mlp.py path/to/disease_symptoms_dataset.csv')
    main(sys.argv[1])
