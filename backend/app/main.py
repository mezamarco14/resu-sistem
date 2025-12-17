from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import endpoints
import os
from pathlib import Path
import mimetypes
import logging

# Fix MIME types on Windows
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI(title="Bulk Email Sender API")

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temp directories if not exist
os.makedirs("temp/uploads", exist_ok=True)
os.makedirs("temp/assets", exist_ok=True)

# Mount temp directory for serving uploaded assets
app.mount("/temp", StaticFiles(directory="temp"), name="temp")

app.include_router(endpoints.router, prefix="/api")

# Serve React Frontend
# Resolve absolute path: backend/app/main.py -> backend/app -> backend -> root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
frontend_dist = BASE_DIR / "frontend" / "dist"
assets_dir = frontend_dist / "assets"

logger.info(f"Frontend Dist: {frontend_dist}")
logger.info(f"Assets Dir: {assets_dir}")
logger.info(f"Assets exist: {assets_dir.exists()}")

if frontend_dist.exists():
    # Mount assets specifically
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
            
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def read_root():
        return {"message": f"Frontend not found at {frontend_dist}. Run 'npm run build' in frontend directory."}
