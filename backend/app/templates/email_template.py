# HTML Email Template for UPT Mass Mailer

def generate_email_html(body_content: str, footer_content: str = "") -> str:
    """Generate a complete HTML email template"""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #f6f7fb;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.08);
        }}
        .header {{
            background-color: rgb(45,54,111);
            text-align: center;
            padding: 20px;
        }}
        .header img {{
            max-height: 70px;
        }}
        .content {{
            padding: 30px;
            line-height: 1.6;
            font-size: 15px;
            color: #333;
        }}
        h2 {{
            color: rgb(45,54,111);
            text-align: center;
        }}
        .flyer {{
            text-align: center;
            margin: 25px 0;
        }}
        .flyer img {{
            width: 100%;
            max-width: 540px;
            border-radius: 10px;
            box-shadow: 0 3px 8px rgba(0,0,0,0.15);
        }}
        .footer {{
            background-color: #f4f4f4;
            text-align: center;
            padding: 15px;
            font-size: 13px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="cid:upt_logo" alt="Universidad Privada de Tacna">
        </div>
        <div class="content">
            {body_content}
            <div class="flyer">
                <img src="cid:flyer_img" alt="Flyer">
            </div>
            {footer_content}
        </div>
    </div>
</body>
</html>
"""
