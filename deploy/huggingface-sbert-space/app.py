import logging
import os
import sys
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("rtadss-sbert-space")

MODEL_NAME = os.getenv("SBERT_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
EXPECTED_EMBEDDING_DIMENSION = 384

app = FastAPI(
    title="Research Topic Approval DSS SBERT Service",
    description="FastAPI SBERT embedding service for free managed staging.",
    version="1.0.0",
)

model: Optional[SentenceTransformer] = None
model_load_error: Optional[str] = None


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to generate embedding for")


class EmbedResponse(BaseModel):
    embedding: List[float] = Field(..., description="384-dimensional embedding vector")
    dimension: int = Field(..., description="Dimension of the embedding vector")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    model: str = Field(..., description="Loaded SBERT model")


def load_model() -> None:
    global model, model_load_error

    logger.info("Loading SBERT model: %s", MODEL_NAME)

    try:
        model = SentenceTransformer(MODEL_NAME)
        probe = model.encode("health probe", convert_to_numpy=True)
        dimension = int(len(probe))

        if dimension != EXPECTED_EMBEDDING_DIMENSION:
            raise RuntimeError(
                f"Expected {EXPECTED_EMBEDDING_DIMENSION}-dimensional embeddings, got {dimension}"
            )

        model_load_error = None
        logger.info("SBERT model loaded successfully with dimension %s", dimension)
    except Exception as exc:
        model = None
        model_load_error = str(exc)
        logger.exception("Failed to load SBERT model")


@app.on_event("startup")
async def startup_event() -> None:
    load_model()


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Research Topic Approval DSS SBERT Service",
        "version": "1.0.0",
        "model": MODEL_NAME,
        "embedding_dimension": EXPECTED_EMBEDDING_DIMENSION,
        "endpoints": {
            "health": "/health",
            "embed": "/embed",
            "docs": "/docs",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=model_load_error or "Model not loaded. Service unavailable.",
        )

    return HealthResponse(
        status="healthy",
        model=MODEL_NAME.split("/")[-1],
    )


@app.post("/embed", response_model=EmbedResponse, tags=["Embeddings"])
async def generate_embedding(request: EmbedRequest):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=model_load_error or "Model not loaded. Service unavailable.",
        )

    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty or whitespace only")

    try:
        embedding = model.encode(text, convert_to_numpy=True).astype(float).tolist()
    except Exception as exc:
        logger.exception("Failed to generate SBERT embedding")
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {exc}")

    if len(embedding) != EXPECTED_EMBEDDING_DIMENSION:
        raise HTTPException(
            status_code=500,
            detail=f"Expected {EXPECTED_EMBEDDING_DIMENSION}-dimensional embedding, got {len(embedding)}",
        )

    return EmbedResponse(embedding=embedding, dimension=len(embedding))
