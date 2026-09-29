# Entry point for cPanel "Setup Python App" (Passenger, WSGI): runs the FastAPI app through a WSGI adapter.
# In cPanel: Application root = this folder, Application startup file = passenger_wsgi.py, entry point = application.
# Author: Khadim Gueye

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.path.join(HERE, "api")
sys.path.insert(0, API)
os.chdir(API)

from a2wsgi import ASGIMiddleware  # noqa: E402

from main import app  # noqa: E402

application = ASGIMiddleware(app)
