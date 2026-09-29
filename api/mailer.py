# Sends emails through the SMTP server set in connection.config (SMTP_HOST, SMTP_PORT, SMTP_USER,
# SMTP_PASSWORD, SMTP_FROM, SMTP_SECURITY = starttls, ssl or none).
# Author: Khadim Gueye

import os
import smtplib
import ssl
from email.message import EmailMessage

import config  # noqa: F401


def configured():
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def send(to, subject, text):
    host = os.environ["SMTP_HOST"]
    security = os.environ.get("SMTP_SECURITY", "starttls").lower()
    port = int(os.environ.get("SMTP_PORT") or (465 if security == "ssl" else 587))
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    context = ssl.create_default_context()
    if security == "ssl":
        server = smtplib.SMTP_SSL(host, port, context=context, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        if security == "starttls":
            server.starttls(context=context)
    with server:
        if os.environ.get("SMTP_USER"):
            server.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        server.send_message(message)
