# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database:
# usiamo SQLite per semplicità (file locale aurora.db).
# In uno scenario reale si può migrare a PostgreSQL/MySQL cambiando solo la URL e la config engine.

SQLALCHEMY_DATABASE_URL = "sqlite:///./aurora.db"

engine = create_engine(

    # SQLite è "single-thread by default".
    # check_same_thread=False permette l'uso con FastAPI durante lo sviluppo.

    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency DB:
# apre una sessione per richiesta e la chiude a fine chiamata (pattern standard FastAPI + SQLAlchemy).

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
