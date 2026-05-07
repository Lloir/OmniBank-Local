from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session
import os
import zipfile
import tempfile
from datetime import datetime

from app.database import get_db

router = APIRouter(prefix="/api/backup", tags=["backup"])

@router.get("/download")
async def download_backup(db: Session = Depends(get_db)):
    # Create a temporary file to hold the zip archive
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    tmp_path = tmp_file.name
    tmp_file.close()
    
    db_path = "data/omnibank.db"
    attachments_dir = "data/attachments"
    
    try:
        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            if os.path.exists(db_path):
                zipf.write(db_path, arcname="omnibank.db")
                
            if os.path.exists(attachments_dir):
                for root, dirs, files in os.walk(attachments_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, start="data")
                        zipf.write(file_path, arcname=arcname)
                        
        filename = f"omnibank_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return FileResponse(
            path=tmp_path,
            filename=filename,
            media_type='application/zip',
            background=BackgroundTask(os.remove, tmp_path)
        )
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")
