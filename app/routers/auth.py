"""
Router di autenticazione (registrazione e login):
- Registrare nuovi utenti (tabella users) e creare un profilo base (tabella client_profiles).
- Autenticare un utente via OAuth2PasswordRequestForm (username=email) e rilasciare un JWT.

Scelte architettura:
- Il ruolo (client/advisor/admin) è un attributo dell'entità User ed è usato per l'ACL (controllo accessi).
- In registrazione impostiamo role="client" per default.
- Il profilo cliente è separato dall’utente: contiene dati “business”, non di sicurezza.
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import (
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

# NOTE: registrazione = (1) controllo unicità email (2) hash password (3) creazione user
#       (4) creazione profilo base collegato (client_profiles) (5) commit atomico.
#  avere fin da subito un profilo minimo rende la UX più lineare lato dashboard.


@router.post("/register", response_model=schemas.UserOut)
def register_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    # 1. Controllo che l'email non sia già registrata
    existing_user = (
        db.query(models.User)
        .filter(models.User.email == user_data.email)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email già registrata",
        )

    # 2. Creo l'utente
    hashed_password = get_password_hash(user_data.password)

    new_user = models.User(
        email=user_data.email,
        password_hash=hashed_password,
        role="client",
    )
    db.add(new_user)

    # flush per avere new_user.id senza fare ancora commit
    db.flush()

    # 3. Creo profilo "base" collegato all'utente,
    #    usando nome e cognome forniti in fase di registrazione.
    new_profile = models.ClientProfile(
        user_id=new_user.id,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
    )
    db.add(new_profile)

    # 4. Commit finale (utente + profilo)
    db.commit()
    db.refresh(new_user)

    return new_user

    """
    Login OAuth2 password flow:
    - OAuth2PasswordRequestForm usa i campi "username" e "password".
      In questo progetto "username" viene interpretato come email.
    - Se le credenziali sono valide, viene emesso un JWT con claim "sub" = user.id.
    - La scadenza del token è gestita da ACCESS_TOKEN_EXPIRE_MINUTES.
    """

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login:
    - form_data.username = email
    - form_data.password = password
    - genera un access token JWT
    """
    # Interpretiamo "username" come email
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},  # nel token salviamo l'id utente
        expires_delta=access_token_expires,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
