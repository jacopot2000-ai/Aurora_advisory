"""
Router gestione richieste di consulenza (/requests):
- Client: crea richiesta, lista "mie richieste", dettaglio, annulla (cancel) o elimina (delete) entro limiti.
- Advisor/Admin: lista globale con filtri e paginazione, cambio stato (patch) con logging audit.
- Storico: endpoint history per consultare la timeline dei cambi stato (audit trail).
- Audit trail: ogni cambio stato scrive su ConsultationRequestStatusLog (chi ha cambiato cosa e quando).
- Cancellazione "soft": per semplicità UI, il client può portare a stato "cancelled" (non sparisce dalla tabella).
- Eliminazione "hard" (DELETE): ammessa solo in stati non lavorati (protezione audit).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, Dict, Any, List
from app.database import get_db
from app.deps import require_advisor
from app.security import get_current_user
from app import models, schemas
from pydantic import BaseModel


router = APIRouter(prefix="/requests", tags=["requests"])

# funzione legacy non più usata (l'ACL ora è gestita da app.deps.require_advisor).
# Tenuta solo per riferimento durante lo sviluppo.
def _require_advisor(user: models.User) -> None:
    if user.role not in ("advisor", "admin"):
        raise HTTPException(status_code=403, detail="Non autorizzato.")

# Helper di serializzazione:
# centralizza la costruzione della response (ConsultationRequestOut) e include campi derivati
# come user_email e user_role (join via joinedload).

def _to_out(req: models.ConsultationRequest) -> schemas.ConsultationRequestOut:
    return schemas.ConsultationRequestOut(
        id=req.id,
        user_id=req.user_id,
        user_email=(req.user.email if getattr(req, "user", None) else None),
        user_role=(req.user.role if getattr(req, "user", None) else None),
        goal=req.goal,
        amount=req.amount,
        monthly_contribution=req.monthly_contribution,
        risk_profile=req.risk_profile,
        time_horizon_years=req.time_horizon_years,
        notes=req.notes,
        status=req.status,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )

# CLIENT: crea richiesta

@router.post("", response_model=schemas.ConsultationRequestOut, status_code=201)
def create_request(
    payload: schemas.ConsultationRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
        # Creazione richiesta lato client:
        # - user_id forzato dall'utente autenticato (non accettiamo user_id dal payload)
        # - normalizzazione minima delle stringhe (strip)
        # - stato iniziale pending

    new_req = models.ConsultationRequest(
    user_id=current_user.id,
    goal=payload.goal.strip(),
    amount=payload.amount,
    monthly_contribution=payload.monthly_contribution,
    risk_profile=payload.risk_profile,
    time_horizon_years=payload.time_horizon_years,
    notes=(payload.notes.strip() if payload.notes else None),
    status=models.RequestStatusEnum.pending,
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    # per avere user_email in risposta senza altra query
    new_req.user = current_user
    return _to_out(new_req)


# CLIENT: lista mie richieste

@router.get("/me", response_model=List[schemas.ConsultationRequestOut])
def list_my_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reqs = (
        db.query(models.ConsultationRequest)
        .options(joinedload(models.ConsultationRequest.user))
        .filter(models.ConsultationRequest.user_id == current_user.id)
        .order_by(models.ConsultationRequest.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in reqs]



# CLIENT: dettaglio mia richiesta

@router.get("/me/{request_id}", response_model=schemas.ConsultationRequestOut)
def get_my_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = (
        db.query(models.ConsultationRequest)
        .options(joinedload(models.ConsultationRequest.user))
        .filter(models.ConsultationRequest.id == request_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Richiesta non trovata.")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato.")
    return _to_out(req)

# Annullamento lato client:
# - scelta: non rimuoviamo la riga dalla UI, ma portiamo lo stato a "cancelled"
# - protezione audit: non si può annullare se già in_review o completed
# - logghiamo sempre l'operazione nello storico cambi stato

@router.patch("/me/{request_id}", status_code=200)
def cancel_my_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = (
        db.query(models.ConsultationRequest)
        .options(joinedload(models.ConsultationRequest.user))
        .filter(
            models.ConsultationRequest.id == request_id,
            models.ConsultationRequest.user_id == current_user.id
        )
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Richiesta non trovata.")

    # protezione audit: se già in lavorazione o completata non può cancellare
    curr_status = req.status.value if hasattr(req.status, "value") else str(req.status)
    if curr_status in ("in_review", "completed"):
        raise HTTPException(
            status_code=400,
            detail="Non puoi cancellare una richiesta già in lavorazione o completata"
        )

    # se già cancelled, idempotente
    if curr_status == "cancelled":
        return {"ok": True, "old_status": "cancelled", "new_status": "cancelled"}

    old_status = curr_status
    req.status = models.RequestStatusEnum.cancelled
    db.add(req)

    log = models.ConsultationRequestStatusLog(
        request_id=req.id,
        changed_by_user_id=current_user.id,
        old_status=old_status,
        new_status="cancelled",
    )
    db.add(log)

    db.commit()
    db.refresh(req)

    return {"ok": True, "old_status": old_status, "new_status": "cancelled"}

# Eliminazione hard (DELETE):
# - concessa solo al proprietario e solo se la richiesta non è stata lavorata
# - utile per "pulizia" di richieste create per errore durante i test
# - in contesti reali spesso si preferisce soft-delete, qui manteniamo hard-delete ma protetto

@router.delete("/me/{request_id}", status_code=204)
def delete_my_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    req = db.query(models.ConsultationRequest).filter(
        models.ConsultationRequest.id == request_id,
        models.ConsultationRequest.user_id == current_user.id
    ).first()


    if not req:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")

    # protezione audit (come volevi tu)
    if req.status in ("in_review", "completed"):
        raise HTTPException(
            status_code=400,
            detail="Non puoi eliminare una richiesta già in lavorazione o completata"
        )

    db.delete(req)
    db.commit()
    return


# -------------------------
# ADVISOR/ADMIN: lista richieste (con filtri + paginazione)
# GET /requests?status=...&q=...&skip=...&limit=...
# ritorna: { items: [...], total: n }
# -------------------------
@router.get("", response_model=schemas.AdminRequestListOut)
def list_all_requests(
    status: Optional[models.RequestStatusEnum] = Query(default=None),
    q: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_advisor),
):
    query = (
        db.query(models.ConsultationRequest)
        .options(joinedload(models.ConsultationRequest.user))
    )

    if status:
        query = query.filter(models.ConsultationRequest.status == status)

    if q and q.strip():
        qq = f"%{q.strip()}%"
        # join per cercare anche sull'email utente
        query = (
            db.query(models.ConsultationRequest)
            .join(models.ConsultationRequest.user)
            .options(joinedload(models.ConsultationRequest.user))
            .filter(
                or_(
                    models.ConsultationRequest.goal.ilike(qq),
                    models.ConsultationRequest.notes.ilike(qq),
                    models.User.email.ilike(qq),
                )
            )
        )

    total = query.count()

    reqs = (
        query.order_by(models.ConsultationRequest.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return schemas.AdminRequestListOut(
        items=[_to_out(r) for r in reqs],
        total=total,
    )

# Cambio stato lato advisor/admin:
# - vincolato da require_advisor (ACL)
# - scrive log di audit (old_status -> new_status + changed_by_user_id)
# - restituisce la richiesta aggiornata per refresh immediato del frontend

@router.patch("/{request_id}", response_model=schemas.ConsultationRequestOut)
def update_request_status(
    request_id: int,
    payload: schemas.ConsultationRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_advisor),
):
    req = (
        db.query(models.ConsultationRequest)
        .options(joinedload(models.ConsultationRequest.user))
        .filter(models.ConsultationRequest.id == request_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Richiesta non trovata.")

    old_status = req.status.value if hasattr(req.status, "value") else str(req.status)
    req.status = models.RequestStatusEnum(payload.status.value)
    db.add(req)

    log = models.ConsultationRequestStatusLog(
        request_id=req.id,
        changed_by_user_id=current_user.id,
        old_status=old_status,
        new_status=payload.status.value,
    )
    db.add(log)
    db.commit()
    db.refresh(req)

    return _to_out(req)

# Storico cambi stato:
# - owner (client) può vedere solo la propria richiesta
# - advisor/admin possono vedere tutte le richieste
# - ordering desc per mostrare prima gli eventi più recenti

@router.get("/{request_id}/history", response_model=list[schemas.ConsultationRequestStatusLogOut])
def get_request_history(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.ConsultationRequest).get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")

    # client può vedere solo la propria richiesta; advisor/admin possono vedere tutto
    if current_user.role not in ("advisor", "admin") and req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    logs = (
        db.query(models.ConsultationRequestStatusLog)
        .filter(models.ConsultationRequestStatusLog.request_id == request_id)
        .order_by(models.ConsultationRequestStatusLog.changed_at.desc())
        .all()
    )
    return logs

