import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import uvicorn

if __name__ == "__main__":
    uvicorn.run("web.api.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
