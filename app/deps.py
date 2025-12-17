# deps.py
# File “ponte”:
# - mantiene un punto di import stabile (get_db) usato dai router
# - contiene dipendenze di autorizzazione (es. require_advisor)


from .database import get_db
from fastapi import Depends, HTTPException
from app.security import get_current_user
from app import models

# Autorizzazione advisor/admin:
# blocca l'accesso alle operazioni riservate (es. gestione richieste nel pannello advisor).
# Se l'utente non ha ruolo adeguato, ritorna 403.

def require_advisor(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role not in ("advisor", "admin"):
        raise HTTPException(status_code=403, detail="Non autorizzato.")
    return current_user
