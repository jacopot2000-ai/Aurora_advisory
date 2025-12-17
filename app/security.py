"""
security.py
Strato sicurezza e autenticazione (JWT).
Contiene:
- Configurazione JWT (SECRET_KEY, algoritmo, scadenza).
- Gestione hashing e verifica password.
- Creazione token di accesso.
- Dipendenza get_current_user: decodifica il token e restituisce l'utente autenticato.

Nota:
- In produzione i segreti (SECRET_KEY) vanno gestiti via variabili d'ambiente e secret manager.
- Qui la configurazione è volutamente semplice per mantenere il progetto chiaro e pulito.
"""

from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from .database import get_db
from . import models

# JWT config:
# SECRET_KEY firma i token (in produzione va letta da variabile d'ambiente, non hard-coded).
# ALGORITHM e scadenza definiscono la sicurezza di sessione lato API.

SECRET_KEY = "super-secret-aurora-key"  
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Gestione password
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2PasswordBearer:
# FastAPI estrae automaticamente il Bearer token dall'header Authorization.
# tokenUrl indica dove avviene il login per ottenere il token.

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Dipendenza di autenticazione:
# - decodifica il JWT
# - estrae l'utente
# - carica l'utente dal DB e lo restituisce ai router protetti

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido o scaduto",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception

        # nel token salviamo l'id dell'utente come stringa
        user_id = int(sub)
    except (JWTError, ValueError):
        # token non decodificabile o sub non convertibile a int
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user


