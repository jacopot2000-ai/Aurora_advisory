"""
Router profilo utente loggato (/me):
- Esporre GET /me/profile: lettura profilo collegato all'utente autenticato.
- Esporre POST /me/profile: upsert (create or update) del profilo.
- L’identità dell’utente deriva dal JWT (get_current_user).
- L’utente può leggere/scrivere SOLO il proprio profilo (vincolo user_id = current_user.id).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(
    prefix="/me",
    tags=["profile"],
)

# GET /me/profile
# Ritorna 404 se il profilo non esiste: il frontend gestisce questo caso mostrando un messaggio
# e invitando alla compilazione.

@router.get("/profile", response_model=schemas.ClientProfileOut)
def read_my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = (
        db.query(models.ClientProfile)
        .filter(models.ClientProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        # Il frontend (dashboard.js) gestisce il 404 e mostra il messaggio
        # "Non abbiamo ancora un profilo salvato..."
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profilo non ancora compilato",
        )

    return profile

# POST /me/profile
# Upsert intenzionale: semplifica il frontend (una chiamata sia per creare che aggiornare).
# I campi aggiornati sono espliciti, per evitare side-effect e rendere chiara la mappatura modello->API.

@router.post("/profile", response_model=schemas.ClientProfileOut)
def upsert_my_profile(
    profile_in: schemas.ClientProfileCreateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea o aggiorna il profilo dell'utente loggato.
    Se non esiste, lo crea.
    Se esiste, aggiorna tutti i campi con i valori ricevuti.
    """
    profile = (
        db.query(models.ClientProfile)
        .filter(models.ClientProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        # Creo un nuovo profilo collegato all'utente
        profile = models.ClientProfile(
            user_id=current_user.id,
            first_name=profile_in.first_name,
            last_name=profile_in.last_name,
            date_of_birth=profile_in.date_of_birth,
            phone=profile_in.phone,
            income=profile_in.income,
            main_goal=profile_in.main_goal,
            time_horizon_years=profile_in.time_horizon_years,
            risk_profile=profile_in.risk_profile,
        )
        db.add(profile)
    else:
        # Aggiorno il profilo esistente
        profile.first_name = profile_in.first_name
        profile.last_name = profile_in.last_name
        profile.date_of_birth = profile_in.date_of_birth
        profile.phone = profile_in.phone
        profile.income = profile_in.income
        profile.main_goal = profile_in.main_goal
        profile.time_horizon_years = profile_in.time_horizon_years
        profile.risk_profile = profile_in.risk_profile

    db.commit()
    db.refresh(profile)
    return profile
