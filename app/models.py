"""
models.py

Qui sono definite le tabelle e le relazioni del database:
- User: credenziali, email e ruolo (client/advisor/admin).
- ClientProfile: dati anagrafici e preferenze del cliente (1:1 con User).
- ConsultationRequest: richieste di consulenza inviate dal cliente (workflow a stati).
- ConsultationRequestStatusLog: audit trail dei cambi di stato (chi/cosa/quando).

Obiettivo: mantenere lo schema dati centralizzato e coerente con le API esposte dai router.
"""
from sqlalchemy import Column, Integer, String, Text, Date, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


from enum import Enum

# Enum applicativi:
# - RiskProfileEnum: profilo rischio cliente (valori consentiti)
# - RequestStatusEnum: stati del ciclo di vita della richiesta (workflow)

class RiskProfileEnum(str, Enum):
    prudente = "prudente"
    equilibrato = "equilibrato"
    dinamico = "dinamico"


class RequestStatusEnum(str, Enum):
    pending = "pending"
    in_review = "in_review"
    completed = "completed"
    cancelled = "cancelled"

# Tabella users:
# - contiene credenziali (password_hash) e ruolo (client/advisor/admin)
# - relazione 1:N con le richieste (ConsultationRequest)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="client", nullable=False)
    requests = relationship(
        "ConsultationRequest",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Tabella client_profiles:
# - estensione “anagrafica” dell’utente (1:1 con users)
# - campi utili per pre-compilare e contestualizzare le richieste di consulenza

class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=True)  # "YYYY-MM-DD"
    phone = Column(String, nullable=True)

    income = Column(Integer, nullable=True)
    main_goal = Column(String, nullable=True)
    time_horizon_years = Column(Integer, nullable=True)
    risk_profile = Column(String, nullable=True)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", backref="profile")

# Tabella consultation_requests:
# - richiesta di consulenza inviata dal cliente
# - stato gestito dal workflow: pending -> in_review -> completed (o cancelled)
# - created_at/updated_at tracciano creazione e ultime modifiche

class ConsultationRequest(Base):
    __tablename__ = "consultation_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    goal = Column(String, nullable=False)                   # es. "Costruzione fondo pensione"
    amount = Column(Float, nullable=False)                  # capitale iniziale
    monthly_contribution = Column(Float, nullable=True)     # versamento mensile opzionale
    risk_profile = Column(String, nullable=False)           # es. "prudente", "equilibrato", "dinamico"
    time_horizon_years = Column(Integer, nullable=False)    # es. 5, 10, 20
    notes = Column(Text, nullable=True)                     # note libere del cliente

    # stato richiesta
    status = Column(String, nullable=False, default="pending") 

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = relationship("User", back_populates="requests")

# Tabella consultation_request_status_logs (audit log):
# - registra ogni cambio di stato (old_status -> new_status)
# - changed_by_user_id identifica chi ha effettuato la modifica (advisor/admin)
# - serve per mostrare lo “storico” nel frontend (pulsante Storico)

class ConsultationRequestStatusLog(Base):
    __tablename__ = "consultation_request_status_logs"

    id = Column(Integer, primary_key=True, index=True)

    request_id = Column(Integer, ForeignKey("consultation_requests.id"), nullable=False)

    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    old_status = Column(String, nullable=True)   
    new_status = Column(String, nullable=False) 

    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("ConsultationRequest", backref="status_logs")
    changed_by = relationship("User")


 