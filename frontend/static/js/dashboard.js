/*
  dashboard.js – Logica pagina Dashboard (utente loggato)
  - Carica e salva il profilo cliente (client_profiles) tramite API protette.
  - Mostra riepilogo dei dati inseriti per conferma visiva.
  - Gestisce navigazione topbar (gestione richieste / mie richieste) e logout.
  Nota: tutte le chiamate passano da apiFetch (token JWT).
*/

console.log("dashboard.js caricato, provo a leggere il profilo...");

function getToken() {
  return localStorage.getItem("access_token");
}

function clearToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("token");     // legacy
  localStorage.removeItem("aa_token");  // legacy
}

function requireAuthOrRedirect() {
  const token = getToken();
  if (!token) {
    window.location.replace("/app/login"); // replace evita back
    return false;
  }
  return true;
}


// CARICAMENTO PROFILO 
// Recupera dal backend il profilo associato all’utente loggato (se esiste).

async function loadProfile() {
  const token = getToken();
  if (!token) {
    console.warn("Nessun token trovato, rimando al login.");
    window.location.href = "/app/login";
    return;
  }

  const welcomeEl = document.getElementById("welcome-text");
  const messageEl = document.getElementById("profile-message");

  try {
    const response = await apiFetch("/me/profile", { method: "GET" });

    console.log("Status /me/profile dalla dashboard:", response.status);

    if (response.status === 404) {
      if (welcomeEl) welcomeEl.textContent = "Benvenuto! Completa il tuo profilo per iniziare.";
      if (messageEl) messageEl.textContent = "Non abbiamo ancora un profilo salvato. Compila il form e premi Salva.";
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      console.error("Errore nel caricamento del profilo:", errData || response.statusText);
      if (welcomeEl) welcomeEl.textContent = "Errore nel caricamento del profilo.";
      if (messageEl) messageEl.textContent = (errData && errData.detail) || "Si è verificato un errore nel caricamento del profilo.";
      return;
    }

    const data = await response.json();
    renderProfileSummary(data);
    console.log("Dati profilo:", data);

    setupAdvisorButton(data);


    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
    if (welcomeEl) welcomeEl.textContent = fullName ? `Benvenuto, ${fullName}` : "Profilo caricato.";

    const form = document.getElementById("profile-form");
    if (form) {
      const fields = ["first_name","last_name","date_of_birth","phone","income","main_goal","time_horizon_years","risk_profile"];
      fields.forEach((field) => {
        const input = document.getElementById(field);
        if (input && data[field] !== undefined && data[field] !== null) input.value = data[field];
      });
    }

    if (messageEl) messageEl.textContent = "Profilo caricato correttamente.";
  } catch (error) {
    console.error("Eccezione durante il caricamento del profilo:", error);
    if (welcomeEl) welcomeEl.textContent = "Errore di rete nel caricamento del profilo.";
    if (messageEl) messageEl.textContent = "Problema di rete durante il caricamento del profilo.";
  }
}


// Salva/aggiorna il profilo: validazione minima lato client, poi persistenza lato backend.


async function handleProfileSubmit(event) {
  event.preventDefault();

  const token = getToken();
  if (!token) {
    window.location.href = "/app/login";
    return;
  }

  const messageEl = document.getElementById("profile-message");

  const payload = {
    first_name: document.getElementById("first_name")?.value || "",
    last_name: document.getElementById("last_name")?.value || "",
    date_of_birth: document.getElementById("date_of_birth")?.value || null,
    phone: document.getElementById("phone")?.value || null,
    income: document.getElementById("income")?.value
      ? parseFloat(document.getElementById("income").value)
      : null,
    main_goal: document.getElementById("main_goal")?.value || null,
    time_horizon_years: document.getElementById("time_horizon_years")?.value
      ? parseInt(document.getElementById("time_horizon_years").value, 10)
      : null,
    risk_profile: document.getElementById("risk_profile")?.value || null,
  };

      console.log("Invio payload /me/profile:", payload);

      try {
        const response = await apiFetch("/me/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });



    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      console.error("Errore nel salvataggio del profilo:", errData || response.statusText);
      if (messageEl) {
        messageEl.textContent =
          (errData && errData.detail) || "Errore nel salvataggio del profilo.";
      }
      return;
    }

    if (messageEl) {
      messageEl.textContent = "Profilo salvato con successo.";
    }

      const updated = await response.json();
      renderProfileSummary(updated);


    // ricarico il profilo per aggiornare il testo di benvenuto ecc.
    await loadProfile();

  } catch (error) {
    console.error("Eccezione durante il salvataggio del profilo:", error);
    if (messageEl) {
      messageEl.textContent = "Problema di rete durante il salvataggio del profilo.";
    }
  }
}

function setupAdvisorButton(profile) {
  const btn = document.getElementById("btn-admin-requests");
  if (!btn) return;

  // prova a leggere il ruolo da vari possibili campi
  const role =
    profile?.role ||
    profile?.user_role ||
    profile?.user?.role ||
    profile?.user?.user_role;

  if (role === "advisor" || role === "admin") {
    btn.style.display = "inline-block";
    btn.addEventListener("click", () => {
      window.location.href = "/app/requests-admin";
    });
  }
}


// LOGOUT 

function setupLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearToken();
      window.location.href = "/app/login";
    });
  }
}

// Entry point: inizializza UI dashboard, carica dati profilo e aggancia gli event listener.

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAuthOrRedirect()) return;


  // Carico profilo all'apertura
  loadProfile();

  // Listener sul form profilo
  const form = document.getElementById("profile-form");
  if (form) {
    form.addEventListener("submit", handleProfileSubmit);
  }
  setupAdvisorButton();
  setupLogout();
});

async function setupAdvisorButton() {
  const btn = document.getElementById("admin-requests-btn");
  if (!btn) return;

  try {
    // Probe: se questa chiamata va, sei advisor/admin
    await apiFetch("/requests?limit=1");
    btn.style.display = "inline-block";
    btn.addEventListener("click", () => {
      window.location.href = "/app/requests-admin";
    });
  } catch (e) {
    // Client: 403 -> niente bottone
    btn.style.display = "none";
  }
}


function isProfileComplete(profile) {
  if (!profile) return false;

  const requiredFields = [
    "date_of_birth",
    "phone",
    "income",
    "main_goal",
    "time_horizon_years",
    "risk_profile",
  ];

  return requiredFields.every((field) => {
    const value = profile[field];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

function renderProfileSummary(profile) {
  const summaryEl = document.getElementById("profile-summary");
  if (!summaryEl) return;  // se per qualsiasi motivo non esiste, non rompiamo nulla

  if (!isProfileComplete(profile)) {
    summaryEl.textContent =
      "Non hai ancora completato il tuo profilo. Compila il modulo a sinistra e salva per vedere qui il riepilogo.";
    return;
  }

  summaryEl.innerHTML = `
    <p><strong>Nome completo:</strong> ${profile.first_name || ""} ${profile.last_name || ""}</p>
    <p><strong>Data di nascita:</strong> ${profile.date_of_birth || "-"}</p>
    <p><strong>Telefono:</strong> ${profile.phone || "-"}</p>
    <p><strong>Reddito annuo:</strong> ${profile.income || "-"}</p>
    <p><strong>Obiettivo principale:</strong> ${profile.main_goal || "-"}</p>
    <p><strong>Orizzonte temporale:</strong> ${profile.time_horizon_years ? profile.time_horizon_years + " anni" : "-"}</p>
    <p><strong>Profilo di rischio:</strong> ${profile.risk_profile || "-"}</p>
  `;
}

window.addEventListener("pageshow", () => {
  // quando torni indietro, se non c'è token, via al login
  if (!requireAuthOrRedirect()) return;
});

window.addEventListener("pageshow", () => {
  const token = localStorage.getItem("access_token");
  if (!token) window.location.href = "/app/login";
});
