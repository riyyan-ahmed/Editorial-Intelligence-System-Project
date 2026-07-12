import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "5433"))
DB_NAME     = os.getenv("DB_NAME",     "editorial_intelligence")
DB_USER     = os.getenv("DB_USER",     "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

QWEN_URL   = os.getenv("QWEN_URL",   "http://localhost:8002/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "Qwen/Qwen2.5-7B-Instruct")
EMBED_URL  = os.getenv("EMBED_URL",  "http://localhost:8080/embed")

JWT_SECRET          = os.getenv("JWT_SECRET", "change-me")
JWT_ALGORITHM       = "HS256"
JWT_EXPIRE_HOURS    = 24
