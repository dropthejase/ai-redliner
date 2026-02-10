import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import invoke_router, models_router, sessions_router

# Logging — file only (configure root logger to capture all modules)
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
_handler = logging.FileHandler(".logs/redliner.log")
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s | %(message)s"))
root_logger.addHandler(_handler)

# FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:3000"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "x-session-id", "x-auto-approve-tools"],
)

# Register route modules
app.include_router(invoke_router)
app.include_router(models_router)
app.include_router(sessions_router)
