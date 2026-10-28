"""
MI-AINA — Moteurs IA : STT (faster-whisper), classification (Ollama
phi3:mini → fallback règles), TTS (edge-tts).
Chaque moteur a un fallback : le front ne connaît qu'un format.
"""
import asyncio
import os
import re
import tempfile
import time

# ============================================================
# STT — faster-whisper (small, ~0,5 Go VRAM, offline)
# ============================================================
_whisper = None
_whisper_tried = False


def get_whisper():
    """Charge le modèle UNE fois. CUDA si dispo, sinon CPU int8."""
    global _whisper, _whisper_tried
    if _whisper_tried:
        return _whisper
    _whisper_tried = True
    try:
        from faster_whisper import WhisperModel
        try:
            _whisper = WhisperModel('small', device='cuda', compute_type='float16')
        except Exception:
            _whisper = WhisperModel('small', device='cpu', compute_type='int8')
    except Exception:
        _whisper = None          # lib absente -> le front restera sur Web Speech
    return _whisper


def transcribe_audio(audio_path, langue=None):
    """Retourne (texte, langue_détectée, durée_ms) ou (None, None, 0) si indisponible."""
    model = get_whisper()
    if not model:
        return None, None, 0
    t0 = time.time()
    kwargs = {'beam_size': 5}
    if langue in ('mg', 'fr'):
        kwargs['language'] = langue
    segments, info = model.transcribe(audio_path, **kwargs)
    texte = ' '.join(s.text.strip() for s in segments).strip()
    return texte, (langue or info.language), int((time.time() - t0) * 1000)


# ============================================================
# CLASSIFICATION — Ollama phi3:mini → fallback règles
# ============================================================
OLLAMA_URL = 'http://localhost:11434/api/generate'
OLLAMA_MODEL = 'phi3:mini'

PROMPT = """Tu es un assistant médical de santé publique à Madagascar.
Analyse la consultation d'un patient de première ligne et réponds UNIQUEMENT avec un JSON valide, sans texte autour :
{{"maladie": "...", "categorie": "...", "urgence": "CRITIQUE|URGENT|PRÉOCCUPANT|MODÉRÉ", "confiance": 0-100, "examens": "..."}}
Règles : fièvre + frissons/courbatures -> paludisme. Fièvre + saignement -> dengue. Toux + gêne respiratoire + SpO2 < 92 -> pneumonie/IRA. Diarrhée -> déshydratation. Sois prudent : toujours proposer la confirmation (TDR, examen).

Transcription : {texte}
Constantes ESP32 : SpO2={spo2}%, T°={temp}°C, Pouls={bpm}bpm
Village : {village}
JSON :"""


def _ollama_classify(texte, vitals, village):
    """Retourne le dict IA ou None (Ollama absent/timeout)."""
    try:
        import requests
        resp = requests.post(OLLAMA_URL, json={
            'model': OLLAMA_MODEL,
            'prompt': PROMPT.format(
                texte=texte[:800],
                spo2=vitals.get('spo2', '?'), temp=vitals.get('temp', '?'),
                bpm=vitals.get('bpm', '?'), village=village or 'non précisé'),
            'stream': False,
            'format': 'json',
            'options': {'temperature': 0.2, 'num_predict': 200},
        }, timeout=45)
        if resp.status_code != 200:
            return None
        raw = resp.json().get('response', '')
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            return None
        import json
        d = json.loads(m.group())
        d.setdefault('urgence', 'PRÉOCCUPANT')
        d.setdefault('confiance', 70)
        d['moteur'] = 'ollama'
        return d
    except Exception:
        return None


# Moteur de règles — fallback fiable, mots-clés malagasy + français
RULES = [
    (['sang', 'ra', 'hémorrag', 'hemorrag', 'pétéchi'], 'Dengue hémorragique (à confirmer)', 'CRITIQUE',
     'NFS plaquettes · test tourniquet'),
    (['convuls', 'fandrerana', 'inconscien', 'tsy mahatsiaro'], 'Urgence neurologique', 'CRITIQUE',
     'Glycémie capillaire · évacuation'),
    (['tazo', 'mivatratra', 'fièvre', 'fever', 'mafana', 'frisson', 'courbatur'], 'Paludisme probable (TDR à confirmer)', 'PRÉOCCUPANT',
     'TDR paludisme · goutte épaisse'),
    (['toux', 'kohoa', 'mifoka', 'respir', 'tenda', 'gorge', 'asthme'], 'Infection respiratoire aiguë (IRA)', 'PRÉOCCUPANT',
     'Comptage FR · SpO₂ de contrôle'),
    (['diarrh', 'kibony', 'vomis', 'mando', 'déshydrat', 'soif'], 'Gastro-entérite / déshydratation', 'PRÉOCCUPANT',
     'SRO + Zinc · poids'),
    (['céphal', 'tête', 'loha', 'vertige', 'lery'], 'Céphalée / HTA à contrôler', 'MODÉRÉ',
     'TA aux 2 bras'),
    (['blessur', 'traumat', 'ratra', 'vla'], 'Traumatisme', 'MODÉRÉ', 'Examen lésions'),
]


def _rules_classify(texte, vitals, village):
    t = (texte or '').lower()
    for mots, maladie, urgence, examens in RULES:
        if any(m in t for m in mots):
            # Ajustement par les constantes : SpO₂ basse monte d'un cran
            spo2 = vitals.get('spo2')
            if spo2 and spo2 < 90 and urgence in ('PRÉOCCUPANT', 'MODÉRÉ'):
                urgence = 'URGENT'
            if vitals.get('temp') and vitals['temp'] >= 39.5 and urgence == 'MODÉRÉ':
                urgence = 'PRÉOCCUPANT'
            return {'maladie': maladie, 'categorie': 'Infectieux' if urgence != 'MODÉRÉ' else 'Général',
                    'urgence': urgence, 'confiance': 72, 'examens': examens, 'moteur': 'regles'}
    return {'maladie': 'Syndrome non spécifié', 'categorie': 'Général',
            'urgence': 'MODÉRÉ', 'confiance': 40, 'examens': 'Examen clinique complet', 'moteur': 'regles'}


def classify(texte, vitals, village=''):
    """Ollama d'abord, règles ensuite. Toujours un dict complet."""
    d = _ollama_classify(texte, vitals, village)
    if d:
        return d
    return _rules_classify(texte, vitals, village)


# ============================================================
# TTS — edge-tts (voix Microsoft naturelles, gratuit)
# ============================================================
VOIX = {'fr': 'fr-FR-DeniseNeural', 'mg': 'fr-FR-DeniseNeural'}  # mg pas dispo -> fr neutre


def speak(texte, langue='fr'):
    """Synthétise vers un fichier temporaire. Retourne le chemin ou None."""
    try:
        import edge_tts

        async def _run():
            out = os.path.join(tempfile.gettempdir(), f'miaina_tts_{int(time.time()*1000)}.mp3')
            c = edge_tts.Communicate(texte[:400], VOIX.get(langue, VOIX['fr']))
            await c.save(out)
            return out

        return asyncio.run(_run())
    except Exception:
        return None