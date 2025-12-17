/*
  requests_admin.js – Pagina advisor/admin "Richieste dei clienti"
  - Lista richieste (GET /requests) con filtro per stato.
  - Modifica stato (PATCH /requests/{id}) con log storico lato backend.
  - Cancellazione richiesta (soft -> stato cancelled) con pulsante dedicato.
  - Visualizzazione storico (GET /requests/{id}/history) in modal.
  Nota: la colonna "Ruolo" mostra user.role per identificare subito il tipo utente.
*/

const tableBody = document.getElementById("requestsTableBody");
const statusFilter = document.getElementById("statusFilter");
const btnDashboard = document.getElementById("btnDashboard");
const btnLogout = document.getElementById("btnLogout");

if (btnDashboard) {
  btnDashboard.addEventListener("click", () => {
    window.location.href = "/app/dashboard";
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    clearAuth();
    window.location.href = "/app/login";
  });
}


async function requireAdvisorOrRedirect() {
  // Se non ho token → login
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");
  if (!token) {
    window.location.replace("/app/login");
    return false;
  }

  // Provo a chiamare un endpoint che è protetto da require_advisor
  // Se risponde 200 → sei advisor/admin
  // Se risponde 403 → sei client
  // Se risponde 401 → token non valido
  try {
    const res = await apiFetch("/requests?limit=1", { method: "GET" });

    if (res.status === 403) {
      window.location.replace("/app/dashboard");
      return false;
    }

    // se arrivo qui, o è 200 oppure apiFetch mi ha già buttato fuori su 401
    if (!res.ok) {
      window.location.replace("/app/dashboard");
      return false;
    }

    return true;
  } catch (err) {
    // apiFetch su 401 fa redirect login + throw
    // su altri errori rimando a dashboard
    window.location.replace("/app/dashboard");
    return false;
  }
}


// Usa apiFetch globale (definita in /static/js/api.js)

async function loadRequests() {
  const status = statusFilter.value; // "" oppure "PENDING" etc
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);

  const res = await apiFetch(`/requests?${qs.toString()}`);
if (!res.ok) {
  const msg = await readErrorMessage(res);
  throw new Error(msg || `HTTP ${res.status}`);
}
const data = await res.json();

  // La API può rispondere sia con { items: [...] } sia con un array diretto [...]
const items = Array.isArray(data) ? data : (data.items || []);
renderTable(items);

}


// Cambio stato (PATCH)
tableBody.addEventListener("change", async (e) => {
  const sel = e.target.closest('select[data-action="status"]');
  if (!sel) return;

  const id = sel.dataset.id;
  const newStatus = sel.value;

  console.log("PATCH status", { id, newStatus });

  try {
    const resp = await apiFetch(`/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    // se apiFetch non lancia errori da solo, gestiamo qui
    if (resp && resp.ok === false) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `HTTP ${resp.status}`);
    }

    // ricarico lista per vedere lo stato aggiornato
    await loadRequests();
  } catch (err) {
    console.error("PATCH failed", err);
    alert("Errore aggiornamento stato: " + (err?.message || err));
    // ricarico per ripristinare lo stato corretto in tabella
    await loadRequests();
  }
});

tableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);
  if (!Number.isFinite(id)) return;

  if (action === "history") {
    await fetchAndShowHistory(id);
  }


  if (action === "cancel") {
    const ok = confirm(`Confermi cancellazione della richiesta #${id}?`);
    if (!ok) return;

    try {
      const resp = await apiFetch(`/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      await loadRequests();
    } catch (err) {
      console.error(err);
      alert("Errore cancellazione richiesta: " + (err?.message || err));
    }
  }
});


function renderTable(items) {
  tableBody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="11">Nessuna richiesta trovata.</td>`;
    tableBody.appendChild(tr);
    return;
  }

  for (const r of items) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.user_email || r.user_id || "-"}</td>
      <td>${escapeHtml(r.goal || "")}</td>
      <td>${formatMoney(r.amount)}</td>
      <td>${escapeHtml(r.risk_profile || "")}</td>
      <td>${escapeHtml(r.status || "")}</td>
      <td>${r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
      <td>${escapeHtml(r.user_role || "-")}</td>
      <td>
        <button class="btn-sm btn-secondary" data-action="history" data-id="${r.id}">Storico</button>
      </td>

      <td>
        ${
          r.status === "cancelled"
            ? `<span class="muted">Richiesta cancellata</span>`
            : `<button class="btn-sm btn-danger" data-action="cancel" data-id="${r.id}">Cancella</button>`
        }
      </td>

      <td>
        <select data-action="status" data-id="${r.id}" ${r.status === "cancelled" ? "disabled" : ""}>
          <option value="pending" ${r.status === "pending" ? "selected" : ""}>pending</option>
          <option value="in_review" ${r.status === "in_review" ? "selected" : ""}>in_review</option>
          <option value="completed" ${r.status === "completed" ? "selected" : ""}>completed</option>
        </select>
      </td>
    `;


    tableBody.appendChild(tr);
  }
}


async function fetchAndShowHistory(requestId) {
  try {
    const resp = await apiFetch(`/requests/${requestId}/history`);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `HTTP ${resp.status}`);
    }

    const logs = await resp.json();

    const html = (!logs || logs.length === 0)
      ? `<p class="muted">Nessun cambio stato registrato.</p>`
      : `<ul class="modal-list">
          ${logs.map(l => {
            const when = l.changed_at ? new Date(l.changed_at).toLocaleString("it-IT") : "-";
            return `<li>
              <div><strong>${l.old_status || "(n/a)"}</strong> → <strong>${l.new_status || "-"}</strong></div>
              <div class="small-muted">${when} • user_id: ${l.changed_by_user_id}</div>
            </li>`;
          }).join("")}
        </ul>`;

    openHistoryModal(`Storico richiesta #${requestId}`, html);
  } catch (err) {
    console.error(err);
    alert("Errore caricamento storico: " + (err?.message || err));
  }
}


function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


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


function formatMoney(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}


window.addEventListener("pageshow", () => {
  const token = localStorage.getItem("access_token");
  if (!token) window.location.href = "/app/login";
});

// Boot pagina: controllo ruolo + primo caricamento tabella
document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireAdvisorOrRedirect();
  if (!ok) return;

  try {
    await loadRequests();
  } catch (err) {
    console.error("Errore loadRequests:", err);
    alert("Errore caricamento richieste: " + (err?.message || err));
  }
});

// Ricarica tabella quando cambio filtro "Stato"
if (statusFilter) {
  statusFilter.addEventListener("change", async () => {
    try {
      await loadRequests();
    } catch (err) {
      console.error("Errore filtro stato:", err);
      alert("Errore filtro richieste: " + (err?.message || err));
    }
  });
}
