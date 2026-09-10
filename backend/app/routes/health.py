from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def check_health():
    """Simple health check endpoint."""
    return {"status": "ok", "message": "Backend is running"}
