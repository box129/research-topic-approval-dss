"""Direct SentenceTransformer bridge for evaluation tooling only."""
import json
import platform
import sys

from sentence_transformers import SentenceTransformer
import sentence_transformers
import torch

payload = json.load(sys.stdin)
model_name = payload["model"]
texts = payload["texts"]
model = SentenceTransformer(model_name)
vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=False, show_progress_bar=False)
json.dump({
    "model": model_name,
    "dimension": int(vectors.shape[1]),
    "vectors": vectors.tolist(),
    "environment": {
        "python": sys.version.split()[0],
        "sentenceTransformers": sentence_transformers.__version__,
        "torch": torch.__version__,
        "platform": platform.platform(),
    },
}, sys.stdout)
