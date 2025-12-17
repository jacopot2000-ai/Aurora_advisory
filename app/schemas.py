"""
schemas.py

Schemi Pydantic (contratti API).
Definiscono cosa entra e cosa esce dalle route FastAPI:

- *In*: payload di input validati (es. create/update).
- *Out*: payload di output serializzati ( liste, dettaglio, storico).
- Enum: valori ammessi per campi come profilo di rischio e stato richiesta.

Nota:
- Gli schemi sono separati dai modelli ORM per evitare di esporre direttamente il DB.
- In alcuni punti gli Enum possono esistere sia lato ORM che lato schema: coerenza e
  chiarezza del contratto verso il frontend.
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from datetime import date, datetime
from typing import Literal, Optional, List
from enum import Enum
from app.models import RiskProfileEnum, RequestStatusEnum

# Schemi Pydantic (contratti API):
# definiscono input/output delle route FastAPI.
# Nota: alcuni Enum sono definiti sia qui che in models.py per compatibilità;
# l'import da app.models (RiskProfileEnum/RequestStatusEnum) è usato nei campi dove serve coerenza con DB.

class RiskProfile(str, Enum):
    prudente = "prudente"
    equilibrato = "equilibrato"
    dinamico = "dinamico"


class RequestStatus(str, Enum):
    pending = "pending"
    in_review = "in_review"
    completed = "completed"
    cancelled = "cancelled"


class RequestSortField(str, Enum):
    created_at = "created_at"
    updated_at = "updated_at"
    amount = "amount"


class SortDirection(str, Enum):
    asc = "asc"
    desc = "desc"


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    first_name: str
    last_name: str
    password: str


class UserOut(UserBase):
    id: int
    role: str

    model_config = ConfigDict(from_attributes=True)


# ---------- Request Schemas ----------

class RequestBase(BaseModel):
    id: int
    goal: str
    amount: float
    risk_profile: RiskProfileEnum
    status: RequestStatusEnum
    time_horizon_years: int
    created_at: datetime

    class Config:
        from_attributes = True


class RequestOut(RequestBase):
    id: int
    status: RequestStatusEnum
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RequestCreate(BaseModel):
    goal: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0, description="Importo in euro, deve essere > 0")
    risk_profile: RiskProfileEnum
    time_horizon_years: int = Field(..., ge=1, le=50, description="Orizzonte temporale tra 1 e 50 anni")
      

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None


class ClientProfileBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    phone: str | None = None
    income: int | None = None
    main_goal: str | None = None
    time_horizon_years: int | None = None
    risk_profile: str | None = None


class ClientProfileCreateUpdate(ClientProfileBase):
    pass


class ClientProfileOut(ClientProfileBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ConsultationRequestBase(BaseModel):
    goal: str = Field(
        ...,
        description="Obiettivo del cliente (es. 'Comprare casa tra 10 anni')",
    )

    amount: float = Field(
        ...,
        ge=0,
        description="Capitale iniziale da investire (> 0)",
    )

    monthly_contribution: Optional[float] = Field(
        default=None,
        ge=0,
        description="Versamento mensile opzionale (>= 0)",
    )

    risk_profile: RiskProfile = Field(
        ...,
        description="Profilo di rischio: prudente / equilibrato / dinamico",
    )

    time_horizon_years: int = Field(
        ...,
        ge=1,
        le=60,
        description="Orizzonte temporale in anni (almeno 1, massimo 60)",
    )

    notes: Optional[str] = Field(
        default=None,
        description="Note libere del cliente",
    )


class ConsultationRequestCreate(ConsultationRequestBase):
    pass


class ConsultationRequestUpdateStatus(BaseModel):
    status: RequestStatus


class ConsultationRequestStatusLogBase(BaseModel):
    request_id: int
    changed_by_user_id: int
    old_status: Optional[str] = None
    new_status: str
    changed_at: datetime

    class Config:
        from_attributes = True  # (orm_mode=True se sei ancora in Pydantic v1)

# Output storico stati (audit log):
# usato dalla UI "Storico" per mostrare chi ha cambiato cosa e quando.

class ConsultationRequestStatusLogOut(ConsultationRequestStatusLogBase):
    id: int

# Output completo richiesta:
# include user_email e user_role per la tabella advisor (requests-admin),
# così il consulente vede subito chi è il cliente e quale ruolo ha l’account.

class ConsultationRequestOut(ConsultationRequestBase):
    id: int
    user_id: int
    user_email: Optional[EmailStr] = None
    user_role: Optional[str] = None
    status: RequestStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsultationRequestSummaryOut(BaseModel):
    id: int
    user_id: int
    topic: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AdminRequestListOut(BaseModel):
    items: List[ConsultationRequestOut] = []
    total: int = 0

    model_config = ConfigDict(from_attributes=True)


class ConsultationRequestStats(BaseModel):
    """
    Riepilogo numerico delle richieste per il pannello del consulente.
    """
    total: int
    pending: int
    in_review: int
    completed: int

class PaginatedMyRequestsOut(BaseModel):
    items: list[ConsultationRequestOut]
    total: int
    page: int
    page_size: int


class PaginatedClientRequestsOut(BaseModel):
    items: list[ConsultationRequestSummaryOut]
    total: int
    page: int
    page_size: int


# Backward-compatible aliases
# Compatibilità temporanea:
# blocco mantenuto per evitare rotture se alcune route/handler usano ancora nomi storici.
# In futuro si potrà rimuovere dopo aver allineato tutti i router agli schemi definitivi.


from typing import Any, List, Optional

# Se nel tuo file esiste già RequestStatus, meglio usarlo.
# Se non esiste, sostituisci RequestStatus con "str".
try:
    RequestStatus  # type: ignore[name-defined]
except NameError:
    RequestStatus = str  # type: ignore[assignment, misc]


class ConsultationRequestStatusUpdate(BaseModel):
    status: RequestStatus


# Alias per compatibilità con i router
try:
    ConsultationRequestStatusLogBase  # se esiste già nel tuo file
except NameError:
    ConsultationRequestStatusLogBase = None

if ConsultationRequestStatusLogBase:
    class ConsultationRequestLogOut(ConsultationRequestStatusLogBase):
        pass
else:
    from datetime import datetime
    from typing import Optional

    class ConsultationRequestLogOut(BaseModel):
        status: RequestStatus
        note: Optional[str] = None
        created_at: Optional[datetime] = None
