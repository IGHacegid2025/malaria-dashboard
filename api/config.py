# Reads connection.config (KEY=VALUE lines) from the project root into the environment.
# Real environment variables always win over the file.
# Author: Khadim Gueye

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.environ.get("CONNECTION_CONFIG", os.path.join(ROOT, "connection.config"))


def load(path=CONFIG_FILE):
    if not os.path.isfile(path):
        return False
    with open(path, encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = (part.strip() for part in line.split("=", 1))
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if key:
                os.environ.setdefault(key, value)
    return True


LOADED = load()
