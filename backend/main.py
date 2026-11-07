"""
SMARTRETURN AI - FastAPI Backend Service
=========================================
This service serves as the API backend for SMARTRETURN AI.
Provides endpoints for OCR receipt extraction, return policy analysis,
automated AI return assistant drafting, and background deadline notifications.
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# 1. Ensure backend root directory is in sys.path before local imports
sys.path.append(str(Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 2. Load environment variables from .env file
load_dotenv()

# 3. Import modular routers
from routers.invoices import router as invoices_router
from routers.assistant import router as assistant_router
from routers.notifications import (
    router as notifications_router,
    start_notification_scheduler,
)

# 4. Lifespan context manager to manage background scheduler loop
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start automated notification scanner background loop
    try:
        start_notification_scheduler()
    except Exception as e:
        print(f"[Warning] Failed to start notification scheduler on startup: {e}")
    yield


# 5. Initialize FastAPI application
app = FastAPI(
    title="SMARTRETURN AI Backend",
    description="Backend API for SMARTRETURN AI SaaS platform",
    version="1.0.0",
    lifespan=lifespan,
)

# 6. Allowed CORS origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:80",
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "*",
]

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 7. Register modular routers
app.include_router(invoices_router)
app.include_router(assistant_router)
app.include_router(notifications_router)


@app.get("/health", tags=["System"])
def health_check():
    """
    Health check endpoint for SMARTRETURN AI.
    Used by the frontend to verify backend availability.
    """
    return {
        "status": "ok",
        "app": "SMARTRETURN AI",
        "service": "FastAPI Backend"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
