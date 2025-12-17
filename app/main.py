# main.py
# Entry-point dell'app FastAPI.
# - Registra i router (auth, profile, requests)
# - Serve il frontend statico (HTML/CSS/JS) dalla cartella /frontend
# - Espone le pagine /app/* come FileResponse (login, dashboard, my-requests, requests-admin)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from app.routers import auth, profile, requests 

app = FastAPI(title="Aurora Advisory API")

# in fase di sviluppo consentiamo richieste da qualunque origine.
# in produzione è meglio restringere allow_origins al dominio effettivo del frontend.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ricerca robusta della cartella "frontend":
# il progetto può essere avviato da posizioni diverse (IDE, terminale, ecc.).
# Cerchiamo "frontend" risalendo alcune directory a partire da questo file.

_here = Path(__file__).resolve()
candidates = [_here.parent, _here.parent.parent, _here.parent.parent.parent]
FRONTEND_DIR = None


for c in candidates:
    if (c / "frontend").exists():
        FRONTEND_DIR = c / "frontend"
        break

if FRONTEND_DIR:
    STATIC_DIR = FRONTEND_DIR / "static"
    if STATIC_DIR.exists():

        # Monta /static per servire CSS/JS/immagini del frontend (es. /static/css/styles.css).

        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Rotte “frontend” (non documentate in OpenAPI): restituiscono direttamente gli HTML.
# L'API vera e propria vive nei router /auth, /profile, /requests.

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/app/login")

    @app.get("/app", include_in_schema=False)
    def app_root():
        return RedirectResponse(url="/app/login")
         
    @app.get("/app/login", include_in_schema=False)
    def serve_login():
        page = FRONTEND_DIR / "login.html"
        return FileResponse(page)

    @app.get("/app/dashboard", include_in_schema=False)
    def serve_dashboard():
        page = FRONTEND_DIR / "dashboard.html"
        return FileResponse(page)

    @app.get("/app/my-requests", include_in_schema=False)
    def serve_my_requests():
        page = FRONTEND_DIR / "my_requests.html"
        return FileResponse(page)

    @app.get("/app/requests-admin", include_in_schema=False)
    def serve_requests_admin_app():
        page = FRONTEND_DIR / "requests_admin.html"
        return FileResponse(page)


   
# --- API routers ---
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(requests.router)
