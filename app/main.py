from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.database import engine, Base
from app.init_data import init_db
import app.models # Important: load models before create_all

# Create tables if they don't exist + run idempotent migrations
init_db()

app = FastAPI(title="OmniBank Local")

# Mount static files
import os
os.makedirs("static", exist_ok=True)
os.makedirs("data/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data/uploads", StaticFiles(directory="data/uploads"), name="uploads")

from app.routers import (
    transactions,
    categories,
    recurrences,
    stats,
    accounts,
    config,
    chat,
    csv_manager,
    ai_helpers,
    budgets,
    backup
)

app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(recurrences.router)
app.include_router(stats.router)
app.include_router(accounts.router)
app.include_router(config.router)
app.include_router(chat.router)
app.include_router(backup.router)
app.include_router(csv_manager.router)
app.include_router(ai_helpers.router)
app.include_router(budgets.router)

from fastapi.responses import FileResponse

@app.get("/")
def serve_spa():
    return FileResponse("static/index.html")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = f"data/uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())
    return {"path": file_location}
