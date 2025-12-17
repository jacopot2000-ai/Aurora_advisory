// auth.js - gestione UI login/registrazione, si appoggia alle funzioni globali di api.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("auth.js caricato, inizializzo UI auth...");

  // Elementi del DOM (se qualche id non esiste, non esplodiamo)
  // Riferimenti DOM
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  // LOGIN: id nel login.html sono "login-email" e "login-password"
  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password");

  // REGISTER: id nel login.html sono "reg-name", "reg-surname", "reg-email", "reg-password"
  const registerNameInput = document.getElementById("reg-name");
  const registerSurnameInput = document.getElementById("reg-surname");
  const registerEmailInput = document.getElementById("reg-email");
  const registerPasswordInput = document.getElementById("reg-password");

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");

  // Messaggi
  const loginMessage = document.getElementById("login-message");
  const registerMessage = document.getElementById("register-message");



  // Tab switching
    function showLogin() {
    if (!loginForm || !registerForm || !tabLogin || !tabRegister) return;
    // Mostra il form di login, nasconde quello di registrazione
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    // Aggiorna lo stato visivo delle tab
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");

    console.log("Mostro il TAB di LOGIN");
  }

  function showRegister() {
    if (!loginForm || !registerForm || !tabLogin || !tabRegister) return;
    // Mostra il form di registrazione, nasconde quello di login
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    // Aggiorna lo stato visivo delle tab
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");

    console.log("Mostro il TAB di REGISTRAZIONE");
  }


  if (tabLogin) {
    tabLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showLogin();
    });
  }

  if (tabRegister) {
    tabRegister.addEventListener("click", (e) => {
      e.preventDefault();
      showRegister();
    });
  }

  // Helpers messaggi
  function clearMessage() {
    if (!loginMessage) return;
    loginMessage.textContent = "";
    loginMessage.className = "message";
  }

  function showMessage(text) {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.className = "message message-success";
  }

  function showError(text) {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.className = "message message-error";
  }

    // --- messaggi per la REGISTRAZIONE ---
  function showRegisterMessage(text) {
    if (!registerMessage) {
      console.warn("Elemento #register-message non trovato");
      return;
    }
    registerMessage.textContent = text;
    registerMessage.style.display = "block";
    registerMessage.style.color = "#0a0";
  }

  function showRegisterError(text) {
    if (!registerMessage) {
      console.warn("Elemento #register-message non trovato");
      return;
    }
    registerMessage.textContent = text;
    registerMessage.style.display = "block";
    registerMessage.style.color = "#d00";
  }

  function clearRegisterMessage() {
    if (!registerMessage) return;
    registerMessage.textContent = "";
    registerMessage.style.display = "none";
  }

   
  function extractToken(loginResponse) {
  if (!loginResponse) return null;

  // a volte può arrivare già come stringa
  if (typeof loginResponse === "string") return loginResponse;

  // casi più comuni
  if (loginResponse.access_token) return loginResponse.access_token;
  if (loginResponse.token) return loginResponse.token;

  // fallback (nel caso qualcuno abbia wrappato la response)
  if (loginResponse.data && loginResponse.data.access_token) return loginResponse.data.access_token;
  if (loginResponse.data && loginResponse.data.token) return loginResponse.data.token;

  return null;
  }

// Salva JWT in localStorage: serve per autorizzare tutte le chiamate successive (apiFetch).

function saveToken(loginResponse) {
  const tokenValue = loginResponse?.access_token;
  const tokenType = loginResponse?.token_type || "bearer";

  if (!tokenValue) {
    throw new Error("Risposta login senza access_token");
  }

  // Chiavi ufficiali
  localStorage.setItem("access_token", tokenValue);
  localStorage.setItem("token_type", tokenType);

  // Pulizia legacy (evita mine future)
  localStorage.removeItem("token");
  localStorage.removeItem("aa_token");

  return tokenValue;
}


  function loadExistingToken() {
  // Se esistono token legacy, migrali una volta e pulisci
  const access = localStorage.getItem("access_token");
  const legacy = localStorage.getItem("token") || localStorage.getItem("aa_token");

  if (!access && legacy) {
    localStorage.setItem("access_token", legacy);
    if (!localStorage.getItem("token_type")) {
      localStorage.setItem("token_type", "bearer");
    }
    localStorage.removeItem("token");
    localStorage.removeItem("aa_token");
  }

  const token = localStorage.getItem("access_token");

  if (token) {
    console.log("Token trovato in localStorage, redirect alla dashboard.");
    window.location.href = "/app/dashboard";
  } else {
    console.log("Nessun token trovato in localStorage all'avvio della pagina.");
  }
}


  // Login: invia credenziali, salva token e reindirizza alla dashboard.

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage();

      const email = (loginEmailInput && loginEmailInput.value || "").trim();
      const password = (loginPasswordInput && loginPasswordInput.value || "").trim();

      if (!email || !password) {
        showError("Inserisci email e password.");
        return;
      }

      try {
        if (typeof window.apiLogin !== "function") {
          console.error("window.apiLogin non è una funzione. api.js caricato?");
          showError("Errore interno: funzione di login non disponibile.");
          return;
        }

        const result = await window.apiLogin(email, password);
        console.log("Risultato apiLogin:", result);

        const token = result.access_token;

        if (!token) {
          throw new Error("Token mancante nella risposta");
        }

        saveToken(result);
        

        // Redirect alla dashboard dopo login riuscito

        window.location.href = "/app/dashboard";
        showMessage("Login effettuato con successo.");
      } 
      
      catch (err) {
        console.error("Errore login:", err);
        const msg = err && err.message ? err.message : "Errore durante il login.";
        showError(msg);
      }
    });
  } else {
    console.warn("Nessun form con id='login-form' trovato nella pagina.");
  }

  
 // Registrazione: crea utente e mostra feedback. Il login avviene separatamente.

  if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      console.log("Submit registrazione...");

      clearRegisterMessage();

      if (!window.apiRegister) {
        console.error("apiRegister non definita. Controlla api.js");
        showRegisterError("Registrazione non disponibile (errore tecnico).");
        return;
      }

        const firstNameInput = registerNameInput;
        const lastNameInput = registerSurnameInput;
        const emailInput = registerEmailInput;
        const passwordInput = registerPasswordInput;


        const firstName = firstNameInput ? firstNameInput.value.trim() : "";
        const lastName = lastNameInput ? lastNameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

      if (!firstName || !lastName || !email || !password) {
        showRegisterError("Compila tutti i campi.");
        return;
      }

      try {
        const result = await window.apiRegister({
          email,
          first_name: firstName,
          last_name: lastName,
          password,
        });

        console.log("Risultato apiRegister:", result);
        showRegisterMessage("Registrazione completata! Ora puoi accedere.");

        // dopo un attimo ti porto nella tab di login
        setTimeout(() => {
          showLogin();  // passa al tab di login
          const loginEmailField = document.getElementById("login-email");
          if (loginEmailField) {
          loginEmailField.value = email;
        }
      }, 800);

      } catch (err) {
        console.error("Errore durante la registrazione:", err);
        let msg = "Registrazione fallita.";
        if (err && err.detail) {
          msg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        } else if (err && err.message) {
          msg = err.message;
        }
        showRegisterError(msg);
      }
    });
  } else {
    console.warn("Nessun form di registrazione trovato (#register-form).");
  }


  // Al caricamento, controlliamo se esiste già un token
  loadExistingToken();
});
