/*
  api.js – Helper centralizzato per chiamate HTTP al backend (FastAPI)
  - Gestisce Base URL, token JWT in localStorage e header Authorization.
  - Espone funzioni riusabili (apiFetch) usate da dashboard, my_requests, requests_admin.
  - Standardizza la gestione errori (401/403 -> logout o redirect quando necessario).
  Nota: avere la logica comune evita duplicazioni nei file di pagina.
*/

const API_BASE_URL = "";  // stesso host/porta della pagina (http://127.0.0.1:8000)

/* Login: chiama /auth/login e restituisce l'oggetto JSON */

async function apiLogin(email, password) {
  const params = new URLSearchParams();

  // il backend OAuth2 di FastAPI si aspetta "username" e "password"

  params.append("username", email);
  params.append("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    console.warn("Impossibile parsare JSON da /auth/login:", e);
  }

  console.log("Risposta /auth/login:", data);

  if (!response.ok) {
    const msg = data && data.detail ? data.detail : `Errore HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
}

/* Registrazione: chiama /auth/register */

async function apiRegister(userData) {
  console.log("Submit registrazione...");

  const response = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Errore HTTP in /auth/register:", response.status, text);
    throw new Error(`Errore HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log("Risposta /auth/register:", data);
  return data;
}

/* Esempio di endpoint protetto: /me/profile */

async function apiProfileMe(token) {
  const response = await fetch(`${API_BASE_URL}/me/profile`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    console.warn("Impossibile parsare JSON da /me/profile:", e);
  }

  console.log("Risposta /me/profile:", data);

  if (!response.ok) {
    const msg = data && data.detail ? data.detail : `Errore HTTP ${response.status}`;
    throw new Error(msg);
  }

  return data;
}


function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token"); // compatibilità se esiste ancora
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Se c'è un body e non è FormData, assicura JSON
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = (typeof FormData !== "undefined") && (options.body instanceof FormData);

  let body = options.body;

  if (hasBody && !isFormData) {
    const hasContentType =
      Object.keys(headers).some((k) => k.toLowerCase() === "content-type");

    if (!hasContentType) {
      headers["Content-Type"] = "application/json";
    }

    // Se body è un oggetto, trasformalo in JSON
    if (typeof body !== "string") {
      body = JSON.stringify(body);
    }
  }

  const res = await fetch(path, { ...options, headers, body });

  if (res.status === 401) {
  clearAuth();
  window.location.replace("/app/login");
  throw new Error("Unauthorized (token missing/expired)");
}

if (res.status === 403) {
  // no logout (token valido) ma blocco accesso
  throw new Error("Forbidden (non autorizzato)");
}
  return res;
}

async function readErrorMessage(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.detail || JSON.stringify(j);
    }
    return await res.text();
  } catch (_) {
    return `HTTP ${res.status}`;
  }
}


window.apiLogin = apiLogin;
window.apiRegister = apiRegister;
window.apiProfileMe = apiProfileMe;
window.readErrorMessage = readErrorMessage;
