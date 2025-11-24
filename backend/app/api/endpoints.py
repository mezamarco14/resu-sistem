from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import shutil
import os
import pandas as pd
from app.services.email_service import email_service
import json
import logging

logger = logging.getLogger("uvicorn")

router = APIRouter()

# --- Models ---
class EmailConfig(BaseModel):
    sender_email: EmailStr
    password: str
    subject: str
    body_html: str
    footer_html: Optional[str] = ""

class LoginRequest(BaseModel):
    username: str
    password: str

# --- In-memory state (for simplicity in this iteration) ---
# In a real app, use a database.
current_campaign = {
    "recipients": [],
    "assets": {},
    "attachments": []
}

# --- Auth ---
@router.post("/auth/login")
def login(creds: LoginRequest):
    # Simple hardcoded check for demonstration
    if creds.username == "admin" and creds.password == "admin123":
        return {"token": "fake-jwt-token-for-demo", "status": "success"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- Uploads ---
@router.post("/upload/excel")
async def upload_excel(file: UploadFile = File(...)):
    file_location = f"temp/uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    # Parse Excel
    try:
        df = pd.read_excel(file_location)
        # Expecting columns like 'Correo', 'NombreConstancia' etc.
        # Convert to list of dicts
        recipients = df.to_dict(orient="records")
        # Clean keys (strip spaces)
        recipients = [{k.strip(): v for k, v in r.items()} for r in recipients]
        
        current_campaign["recipients"] = recipients
        return {"count": len(recipients), "preview": recipients[:5]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing Excel: {str(e)}")

@router.post("/upload/asset")
async def upload_asset(file: UploadFile = File(...), type: str = Form(...)):
    try:
        # type: 'logo', 'flyer'
        os.makedirs("temp/assets", exist_ok=True)
        file_location = f"temp/assets/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        current_campaign["assets"][type] = file_location
        
        return {"status": "uploaded", "path": file_location}
    except Exception as e:
        logger.error(f"Error uploading asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/assets-folder")
async def upload_assets_folder(files: List[UploadFile] = File(...), folder_type: str = Form(...)):
    try:
        # folder_type: 'folder1', 'folder2'
        saved_paths = []
        
        # Sort files numerically by extracting ONLY the number from filename
        # Works with: "1_archivo.pdf", "2.docx", "10_documento.xlsx", etc.
        import re
        def extract_number(filename):
            # Extract the first number found in the filename
            match = re.search(r'(\d+)', filename)
            return int(match.group(1)) if match else 999999
        
        # Sort files by the extracted number
        sorted_files = sorted(files, key=lambda f: extract_number(f.filename))
        
        target_dir = f"temp/assets/{folder_type}"
        os.makedirs(target_dir, exist_ok=True)
        
        logger.info(f"Uploading {len(sorted_files)} files to {folder_type}")
        
        for file in sorted_files:
            # Get just the filename, removing any path components
            # This handles cases where the browser sends the full path
            filename = os.path.basename(file.filename)
            
            # Save directly in the target directory (no subdirectories)
            file_location = os.path.join(target_dir, filename)
            
            logger.info(f"Saving file: {filename} -> {file_location}")
            
            with open(file_location, "wb+") as file_object:
                shutil.copyfileobj(file.file, file_object)
            
            saved_paths.append(file_location)
        
        if folder_type == "folder1":
            current_campaign["attachments_folder1"] = saved_paths
        elif folder_type == "folder2":
            current_campaign["attachments_folder2"] = saved_paths
            
        logger.info(f"Successfully uploaded {len(saved_paths)} files to {folder_type}")
        logger.info(f"File paths: {saved_paths}")
        return {"status": "uploaded", "count": len(saved_paths)}
    except Exception as e:
        logger.error(f"Error uploading assets folder: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# --- Sending ---
def background_send_emails(config: EmailConfig, recipients: List[dict], assets: dict, folder1: List[str], folder2: List[str]):
    from datetime import datetime
    import time
    
    logger.info(f"Starting background email send for {len(recipients)} recipients")
    logger.info(f"Config: Subject='{config.subject}', Sender='{config.sender_email}'")
    
    total_recipients = len(recipients)
    report_data = []  # Store report as list of dicts for JSON response
    
    try:
        for i, recipient in enumerate(recipients):
            # Basic logic: assume 'Correo' column exists
            email_addr = recipient.get("Correo") or recipient.get("Email") or recipient.get("correo")
            nombre = recipient.get("Nombre") or recipient.get("nombre") or "N/A"
            
            if not email_addr:
                logger.warning(f"Skipping recipient {i}: No email address found in {recipient}")
                continue

            # Dynamic replacement in body (e.g. {{Nombre}})
            body_content = config.body_html
            for key, value in recipient.items():
                if value:
                    body_content = body_content.replace(f"{{{{{key}}}}}", str(value))
            
            # Create complete HTML email with template
            html_email = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f6f7fb;">
    <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
        <div style="background-color: rgb(45,54,111); text-align: center; padding: 20px;">
            <img src="cid:upt_logo" alt="Logo" style="max-height: 70px;">
        </div>
        <div style="padding: 30px; line-height: 1.6; font-size: 15px; color: #333;">
            {body_content}
        </div>
        <div style="text-align: center; padding: 0 30px 10px 30px;">
            <img src="cid:flyer_img" alt="Flyer" style="width: 100%; max-width: 540px; border-radius: 10px;">
        </div>
        <div style="padding: 20px 30px; line-height: 1.4; font-size: 13px; color: #666; border-top: 1px solid #eee;">
            {config.footer_html}
        </div>
    </div>
</body>
</html>"""

            # Determine attachments
            attachments = []
            adj1_name = ""
            adj2_name = ""

            # Sequential Mapping: Row i gets File i
            if i < len(folder1):
                attachments.append(folder1[i])
                adj1_name = os.path.basename(folder1[i])
            
            if i < len(folder2):
                attachments.append(folder2[i])
                adj2_name = os.path.basename(folder2[i])
            
            # Try sending with retries
            intentos = 0
            estado = "Error"
            duracion = 0
            max_intentos = 2
            
            while intentos < max_intentos:
                inicio = time.time()
                intentos += 1
                
                logger.info(f"Sending to {email_addr}, attempt {intentos}")
                
                try:
                    success = email_service.send_email(
                        sender_email=config.sender_email,
                        password=config.password,
                        recipient_email=email_addr,
                        subject=config.subject,
                        html_body=html_email,
                        images=assets,
                        attachments=attachments
                    )
                except Exception as e:
                    logger.error(f"CRITICAL ERROR calling email_service: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    success = False
                
                duracion = round(time.time() - inicio, 2)
                
                if success:
                    estado = "Enviado"
                    logger.info(f"Successfully sent to {email_addr}")
                    break
                else:
                    logger.warning(f"Failed to send to {email_addr}, attempt {intentos}")
                
                time.sleep(1)  # Wait before retry
            
            # Add to report data
            fecha = datetime.now().strftime("%Y-%m-%d")
            hora = datetime.now().strftime("%H:%M:%S")
            report_data.append({
                "correo": email_addr,
                "nombre": nombre,
                "estado": estado,
                "fecha": fecha,
                "hora": hora,
                "intentos": intentos,
                "duracion": duracion,
                "adjunto1": adj1_name,
                "adjunto2": adj2_name
            })
        
        # Store report in memory
        current_campaign["report_data"] = report_data
        logger.info(f"Reporte generado con {len(report_data)} registros")

    except Exception as e:
        logger.error(f"GLOBAL ERROR in background_send_emails: {e}")
        import traceback
        logger.error(traceback.format_exc())

@router.post("/send")
async def send_campaign(config: EmailConfig, background_tasks: BackgroundTasks):
    if not current_campaign["recipients"]:
        raise HTTPException(status_code=400, detail="No recipients loaded")
    
    assets_map = {}
    if "logo" in current_campaign["assets"]:
        assets_map["upt_logo"] = current_campaign["assets"]["logo"]
    if "flyer" in current_campaign["assets"]:
        assets_map["flyer_img"] = current_campaign["assets"]["flyer"]

    background_tasks.add_task(
        background_send_emails,
        config,
        current_campaign["recipients"],
        assets_map,
        current_campaign.get("attachments_folder1", []),
        current_campaign.get("attachments_folder2", [])
    )
    
    return {"message": "Sending started in background", "recipient_count": len(current_campaign["recipients"])}

@router.get("/get-report")
async def get_report():
    """Get the report data as JSON for display in the UI"""
    if "report_data" not in current_campaign or not current_campaign["report_data"]:
        return {"report": [], "message": "No report available yet"}
    
    return {"report": current_campaign["report_data"], "total": len(current_campaign["report_data"])}

@router.post("/clear-campaign")
async def clear_campaign():
    """Clear all current campaign data"""
    global current_campaign
    current_campaign = {
        "recipients": [],
        "assets": {},
        "attachments": [],
        "report_data": []
    }
    # Optional: Clean up temp files if desired, but for now just clearing memory
    return {"message": "Campaign data cleared successfully"}

@router.get("/download-template")
async def download_template():
    """Download Excel template for recipients"""
    template_path = "templates/plantilla_destinatarios.xlsx"
    
    if not os.path.exists(template_path):
        # Create template if it doesn't exist
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Destinatarios"
        ws.append(["Correo", "Nombre", "Cargo", "Facultad"])
        ws.append(["ejemplo1@gmail.com", "Juan Pérez", "Estudiante", "Ingeniería"])
        ws.append(["ejemplo2@hotmail.com", "María López", "Docente", "Ciencias"])
        ws.append(["ejemplo3@upt.edu.pe", "Pedro García", "Egresado", "Arquitectura"])
        os.makedirs("templates", exist_ok=True)
        wb.save(template_path)
    
    return FileResponse(
        template_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="plantilla_destinatarios.xlsx"
    )
