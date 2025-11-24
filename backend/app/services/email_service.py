import smtplib
import os
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from typing import List, Optional
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def is_valid_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

class EmailService:
    def __init__(self):
        # Will be configured based on sender email
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 465
    
    def get_smtp_config(self, sender_email: str):
        """Detect SMTP server based on email domain"""
        domain = sender_email.split('@')[-1].lower()
        
        # Gmail
        if 'gmail.com' in domain:
            return "smtp.gmail.com", 465
        # Outlook/Hotmail
        elif 'outlook' in domain or 'hotmail' in domain or 'live.com' in domain:
            return "smtp-mail.outlook.com", 587
        # Yahoo
        elif 'yahoo' in domain:
            return "smtp.mail.yahoo.com", 465
        # UPT or other institutional emails
        elif 'upt.edu.pe' in domain:
            return "smtp.upt.edu.pe", 587
        # Generic fallback
        else:
            return f"smtp.{domain}", 587

    def send_email(
        self,
        sender_email: str,
        password: str,
        recipient_email: str,
        subject: str,
        html_body: str,
        images: dict = None,
        attachments: List[str] = None
    ) -> bool:
        try:
            # Validate recipient email
            if not is_valid_email(recipient_email):
                logger.warning(f"Invalid email format: {recipient_email}")
                return False
            
            # Get SMTP configuration
            smtp_server, smtp_port = self.get_smtp_config(sender_email)
            logger.info(f"Using SMTP: {smtp_server}:{smtp_port} for {sender_email}")
            
            msg_root = MIMEMultipart("related")
            msg_root["From"] = sender_email
            msg_root["To"] = recipient_email
            msg_root["Subject"] = subject

            msg_alternative = MIMEMultipart("alternative")
            msg_root.attach(msg_alternative)
            msg_alternative.attach(MIMEText(html_body, "html", "utf-8"))

            # Embed images
            if images:
                for cid, path in images.items():
                    if os.path.exists(path):
                        with open(path, "rb") as img:
                            mime_img = MIMEImage(img.read())
                            mime_img.add_header("Content-ID", f"<{cid}>")
                            mime_img.add_header("Content-Disposition", 'inline; filename=""')
                            msg_root.attach(mime_img)
                    else:
                        logger.warning(f"Image not found: {path}")

            # Attach files (any extension)
            if attachments:
                for file_path in attachments:
                    if os.path.exists(file_path):
                        with open(file_path, "rb") as f:
                            # Get file extension
                            ext = os.path.splitext(file_path)[1][1:]  # Remove the dot
                            adj = MIMEApplication(f.read(), _subtype=ext if ext else "octet-stream")
                            adj.add_header(
                                "Content-Disposition", 
                                "attachment", 
                                filename=os.path.basename(file_path)
                            )
                            msg_root.attach(adj)
                    else:
                        logger.warning(f"Attachment not found: {file_path}")

            # Send using proven SMTP logic (from user's working code)
            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=30) as server:
                    server.login(sender_email, password)
                    server.send_message(msg_root)
            else:
                with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
                    server.starttls()
                    server.login(sender_email, password)
                    server.send_message(msg_root)
            
            logger.info(f"Email sent successfully to {recipient_email}")
            return True

        except Exception as e:
            logger.error(f"Error sending email to {recipient_email}: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

email_service = EmailService()
