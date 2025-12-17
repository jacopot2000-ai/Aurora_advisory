/*
  my_requests.js – Pagina client "Le mie richieste"
  - Mostra la lista richieste dell’utente loggato (GET /requests/me).
  - Permette inserimento nuova richiesta (POST /requests).
  - Permette cancellazione "soft" della propria richiesta (DELETE /requests/me/{id} -> stato cancelled).
  - Permette consultazione storico cambi stato (GET /requests/{id}/history) tramite popup/modal.
*/

console.log("my_requests.js caricato");

// Usa apiFetch globale (definita in /static/js/api.js)


// Render della tabella richieste
function renderRequestsTable(items) {
  const tbody = document.querySelector("#requests-table-body");
  if (!tbody) {
    console.error("Elemento #requests-table-body non trovato");
    return;
  }

  tbody.innerHTML = "";

  if (!items || items.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Non hai ancora inviato richieste.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const req of items) {
    const tr = document.createElement("tr");

    const id = req.id;
    const goal = req.goal;
    const amount = req.amount; 
    const riskProfile = req.risk_profile; 
    const status = req.status;
    const createdAt = req.created_at; 

    const amountFormatted = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

    const dateFormatted = createdAt
      ? new Date(createdAt).toLocaleDateString("it-IT")
      : "-";

    tr.innerHTML = `
      <td>${id}</td>
      <td>${goal}</td>
      <td>${amountFormatted}</td>
      <td>${riskProfile}</td>
      <td>${status}</td>
      <td>${dateFormatted}</td>
      <td>
        <button class="btn-sm btn-secondary" data-action="history" data-id="${id}">Storico</button>
        ${
          status === "cancelled"
            ? `<span class="muted">Richiesta cancellata</span>`
            : `<button class="btn-sm btn-danger" data-action="cancel" data-id="${id}">Cancella</button>`
        }
      </td>

    `;

    tbody.appendChild(tr);
  }
}

// Carica e renderizza la tabella delle richieste del client (solo le sue).

async function loadRequests() {
  try {
    const resp = await apiFetch("/requests/me");

    console.log("Status /requests/me:", resp.status);

    if (!resp.ok) {
      throw new Error("Errore nel caricamento delle richieste: " + resp.status);
    }

    const data = await resp.json();
    console.log("Payload /requests/me:", data);

    const items = Array.isArray(data) ? data : (data.items || []);
    renderRequestsTable(items);
  } catch (err) {
    console.error("Errore nel caricamento delle richieste:", err);
    alert("Errore nel caricamento delle richieste. Riprova più tardi.");
  }
}

// Crea una nuova richiesta: invio dati minimi + aggiornamento tabella a schermo.

async function handleNewRequestSubmit(event) {
  event.preventDefault();
  console.log("handleNewRequestSubmit chiamata");

  // 1. Recupero sicuro dei campi dal DOM
  const goalInput = document.getElementById("new-request-goal");
  const amountInput = document.getElementById("new-request-amount");
  const timeHorizonInput = document.getElementById("new-request-time-horizon");
  const riskProfileSelect = document.getElementById("new-request-risk-profile");

  if (!goalInput || !amountInput || !timeHorizonInput || !riskProfileSelect) {
    console.error("Campo del form non trovato", {
      goalInput,
      amountInput,
      timeHorizonInput,
      riskProfileSelect,
    });
    alert("Errore interno nel form. Ricarica la pagina e riprova.");
    return;
  }

  // 2. Lettura valori grezzi dal form
  const goal = goalInput.value.trim();
  const amountRaw = amountInput.value.trim().replace(",", ".");
  const timeHorizonRaw = timeHorizonInput.value.trim();
  const riskProfile = riskProfileSelect.value;

  const amount = Number(amountRaw);
  const timeHorizonYears = Number.parseInt(timeHorizonRaw, 10);

  // 3. Validazione lato client

  // 3.1 Obiettivo
  if (!goal) {
    alert("Inserisci un obiettivo per la tua richiesta.");
    goalInput.focus();
    return;
  }

  // 3.2 Importo
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("L'importo deve essere un numero positivo maggiore di zero.");
    amountInput.focus();
    return;
  }

  // controllo decimali
  if (!Number.isInteger(amount)) {
    alert("L'importo deve essere un numero intero (senza decimali).");
    amountInput.focus();
    return;
  }

  if (amount <= 0) {
    alert("L'importo deve essere maggiore di 0.");
    amountInput.focus();
    return;
  }

  // 3.3 Orizzonte temporale
  if (!Number.isFinite(timeHorizonYears)) {
    alert("Inserisci un orizzonte temporale valido (anni interi).");
    timeHorizonInput.focus();
    return;
  }
  if (timeHorizonYears < 1) {
    alert("L'orizzonte temporale deve essere almeno 1 anno.");
    timeHorizonInput.focus();
    return;
  }
  if (timeHorizonYears > 50) {
    alert("L'orizzonte temporale non può superare i 50 anni.");
    timeHorizonInput.focus();
    return;
  }

  // 3.4 Profilo di rischio
  if (!riskProfile) {
    alert("Seleziona un profilo di rischio.");
    riskProfileSelect.focus();
    return;
  }

  const payload = {
    goal: goal,
    amount: amount,
    time_horizon_years: timeHorizonYears,
    risk_profile: riskProfile,
  };

  console.log("Invio payload /requests:", payload);

  // 4. Invio al backend
  try {
    // preparo gli header, inclusa l'Authorization se ho il token
    const headers = {
      "Content-Type": "application/json",
    };

    const response = await apiFetch("/requests", {
      method: "POST",
      body: payload,
    });



    if (!response.ok) {
      let errorText;
      try {
        const data = await response.json();
        errorText = JSON.stringify(data);
      } catch (e) {
        errorText = await response.text();
      }

      console.error("Errore HTTP su /requests:", response.status, errorText);
      alert("Errore nel salvataggio della richiesta. Codice: " + response.status);
      return;
    }

    alert("Richiesta salvata correttamente.");

    // ricarico la tabella
    await loadRequests();

    // reset form
    goalInput.value = "";
    amountInput.value = "";
    timeHorizonInput.value = "";
    riskProfileSelect.value = "";
  } catch (error) {
    console.error("Errore inatteso nel salvataggio della richiesta:", error);
    alert("Errore imprevisto nel salvataggio della richiesta. Controlla la console.");
  }
}

// Cancella richiesta (soft): il backend la marca come "cancelled" e blocca modifiche successive.

async function handleCancelRequest(requestId, actionCellEl) {
  const ok = confirm(`Vuoi cancellare la richiesta #${requestId}?`);
  if (!ok) return;

  try {
    const resp = await apiFetch(`/requests/me/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `HTTP ${resp.status}`);
    }

    const cancelBtn = actionCellEl.querySelector(`button[data-action="cancel"][data-id="${requestId}"]`);
    if (cancelBtn) cancelBtn.remove();

    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Richiesta cancellata";
    actionCellEl.appendChild(span);

    const tr = actionCellEl.closest("tr");
    if (tr) {
      const statusTd = tr.children[4];
      if (statusTd) statusTd.textContent = "cancelled";
    }
  } catch (err) {
    console.error(err);
    alert("Errore cancellazione richiesta: " + (err?.message || err));
  }
}


// Inizializzazione
document.addEventListener("DOMContentLoaded", () => {
  console.log("my_requests.js caricato");

      // Pulsante "Torna alla dashboard"
    const backToDashboardBtn = document.getElementById("back-to-dashboard-button");
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener("click", () => {
            window.location.href = "/app/dashboard";
        });
    }

      // Pulsante "Esci"
    const logoutBtn = document.getElementById("logout-button");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Svuoto il token e rimando al login
            localStorage.removeItem("access_token");
            window.location.href = "/app/login";
        });
    }
    
  const backBtn = document.getElementById("back-to-dashboard");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/app/dashboard";
    });
  }

  const form = document.getElementById("new-request-form");
    console.log("Form nuova richiesta trovato?", !!form);

    if (form) {
        form.addEventListener("submit", handleNewRequestSubmit);
    }

  loadRequests();

  const tbody = document.querySelector("#requests-table-body");

  if (tbody) {
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (!Number.isFinite(id)) return;

      if (action === "cancel") {
        const actionCell = btn.closest("td");
        if (actionCell) await handleCancelRequest(id, actionCell);
      }

      if (action === "history") {
        await handleShowHistory(id);
      }

    });
  }

});

// Storico: apre un modal con la timeline dei cambi stato (chi/quando/cosa).

function openHistoryModal(title, htmlBody) {
  const modal = document.getElementById("historyModal");
  const t = document.getElementById("historyTitle");
  const b = document.getElementById("historyBody");
  if (!modal || !t || !b) return;

  t.textContent = title;
  b.innerHTML = htmlBody;
  modal.classList.remove("hidden");
}

function closeHistoryModal() {
  const modal = document.getElementById("historyModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "historyClose") closeHistoryModal();
});

async function handleShowHistory(requestId) {
  try {
    const resp = await apiFetch(`/requests/${requestId}/history`);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `HTTP ${resp.status}`);
    }

    const logs = await resp.json();

    let html = "";
    if (!logs || logs.length === 0) {
      html = `<p class="muted">Nessuna modifica registrata.</p>`;
    } else {
      html = `
        <ul class="modal-list">
          ${logs.map(l => {
            const when = l.changed_at ? new Date(l.changed_at).toLocaleString("it-IT") : "-";
            const oldS = l.old_status || "(n/a)";
            const newS = l.new_status || "-";
            return `
              <li>
                <div><strong>${oldS}</strong> → <strong>${newS}</strong></div>
                <div class="small-muted">${when} • user_id: ${l.changed_by_user_id}</div>
              </li>
            `;
          }).join("")}
        </ul>
      `;
    }

    openHistoryModal(`Storico richiesta #${requestId}`, html);
  } catch (err) {
    console.error(err);
    alert("Errore caricamento storico: " + (err?.message || err));
  }
}


window.addEventListener("pageshow", () => {
  const token = localStorage.getItem("access_token");
  if (!token) window.location.href = "/app/login";
});
