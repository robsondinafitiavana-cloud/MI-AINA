"""Inference adapter for the separately trained MI-AINA MLP artifacts."""
import json
import os
import threading
import unicodedata

_lock = threading.Lock()
_artifacts = None


def _load_artifacts():
    """Load artifacts lazily so Django remains usable without TensorFlow installed."""
    global _artifacts
    if _artifacts is not None:
        return _artifacts
    model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
    try:
        with open(os.path.join(model_dir, 'selected_features.json'), encoding='utf-8') as f:
            schema = json.load(f)
        with open(os.path.join(model_dir, 'model_metadata.json'), encoding='utf-8') as f:
            metadata = json.load(f)
        with open(os.path.join(os.path.dirname(__file__), 'clinical_features.json'), encoding='utf-8') as f:
            feature_config = json.load(f)
        if metadata.get('feature_selection_source') != 'ai/clinical_features.json':
            return None  # Refuse the older model trained on the full 230-feature dataset.
        if not set(schema.get('features', [])).issubset(set(feature_config.get('model_inputs', []))):
            return None
        import joblib
        scaler_artifact = joblib.load(os.path.join(model_dir, 'scaler.pkl'))
        encoder = joblib.load(os.path.join(model_dir, 'label_encoder.pkl'))
        from tensorflow.keras.models import load_model
        model = load_model(os.path.join(model_dir, 'mi_aina_mlp.keras'))
        _artifacts = (schema, metadata, scaler_artifact, encoder, model)
        return _artifacts
    except (OSError, ValueError, ImportError, EOFError):
        return None


def _feature_value(name, data):
    """Map the small, reviewed clinical input vocabulary to training features."""
    def norm(value):
        value = unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode().lower()
        return ''.join(ch for ch in value if ch.isalnum())
    key = norm(name)
    symptom = (data.get('symptoms') or {})
    aliases = {
        'age': data.get('age'), 'sex': data.get('sex'),
        'temperature': data.get('temperature'), 'temperature_c': data.get('temperature'),
        'heart_rate': data.get('heart_rate'), 'heart_rate_bpm': data.get('heart_rate'),
        'bpm': data.get('heart_rate'), 'spo2': data.get('oxygen_saturation'),
        'oxygen_saturation': data.get('oxygen_saturation'),
        'respiratory_rate': data.get('respiratory_rate'),
        'blood_pressure': data.get('blood_pressure'), 'weight': data.get('weight'),
        'height': data.get('height'), 'bmi': data.get('bmi'),
    }
    aliases = {norm(name): value for name, value in aliases.items()}
    if key in aliases:
        return aliases[key]
    normalized = {norm(k): v for k, v in symptom.items()}
    if key in normalized:
        return normalized[key]
    translations = {
        'fever': ['fievre'], 'chills': ['frissons'], 'musclepain': ['courbatures'],
        'cough': ['toux'], 'difficultybreathing': ['difficulterespiratoire'],
        'shortnessofbreath': ['difficulterespiratoire'], 'vomiting': ['vomissements'],
        'diarrhea': ['diarrhee'], 'abdominalpain': ['douleursabdominales'],
        'headache': ['mauxdetete'], 'skinrash': ['eruptioncutanee'],
        'lossofappetite': ['refusdesalimenter'], 'fatigue': ['abattement'],
        'seizure': ['convulsions'], 'convulsions': ['convulsions'],
        'bleeding': ['saignement'], 'injury': ['blessure'],
    }
    for canonical, aliases in translations.items():
        if key == norm(canonical) or key in [norm(alias) for alias in aliases]:
            for alias in [canonical] + aliases:
                if norm(alias) in normalized:
                    return normalized[norm(alias)]
    return None


def predict_disease(patient_data):
    """Return model scores, or a safe unavailable/insufficient status."""
    artifacts = _load_artifacts()
    if not artifacts:
        return {'ok': False, 'status': 'model_unavailable', 'results': [],
                'message': 'Le modèle MLP entraîné est indisponible.'}
    schema, metadata, scaler_artifact, encoder, model = artifacts
    features = schema.get('features', [])
    categorical = set(schema.get('categorical_features', []))
    categories = schema.get('categories', {})
    raw = {name: _feature_value(name, patient_data) for name in features}
    available = sum(value is not None and value != '' for value in raw.values())
    minimum = metadata.get('minimum_available_features')
    if minimum is None:
        return {'ok': False, 'status': 'insufficient_data', 'results': [],
                'message': 'Le seuil minimal de données attend l’évaluation clinique du modèle.'}
    minimum = int(minimum)
    if available < minimum:
        return {'ok': False, 'status': 'insufficient_data', 'results': [],
                'available_features': available, 'required_features': minimum}

    # Recreate the exact stored one-hot columns and raw feature order.
    import numpy as np
    row = []
    sources = schema.get('transformed_sources', [])
    for source in sources:
        name, category = source
        value = raw.get(name)
        if category is not None:
            normalized_value = '__MISSING__' if value in (None, '') else str(value)
            row.append(float(normalized_value == str(category)))
        else:
            try:
                row.append(float(value) if value not in (None, '') else
                           float(schema.get('numeric_medians', {}).get(name, 0)))
            except (TypeError, ValueError):
                row.append(float(schema.get('numeric_medians', {}).get(name, 0)))
    vector = np.asarray([row], dtype='float32')
    if scaler_artifact.get('scaler') is not None:
        indices = scaler_artifact.get('numeric_indices', [])
        vector[:, indices] = scaler_artifact['scaler'].transform(vector[:, indices])
    scores = np.asarray(model.predict(vector, verbose=0))[0]
    if scores.ndim != 1 or len(scores) != len(encoder.classes_) or not np.isfinite(scores).all():
        return {'ok': False, 'status': 'insufficient_data', 'results': []}
    top = np.argsort(scores)[::-1][:3]
    return {'ok': True, 'status': 'ok', 'score_type': 'model_score',
            'missing_optional_features': [name for name in metadata.get('optional_sensor_features', [])
                                           if raw.get(name) in (None, '')],
            'results': [{'disease': str(encoder.inverse_transform([int(i)])[0]),
                         'score': float(scores[i])} for i in top]}
