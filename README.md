Aurora Advisory

Prototipo di applicazione web per la gestione di richieste di consulenza finanziaria

Questo repository contiene il codice sorgente del project work "Aurora Advisory", sviluppato come prototipo didattico nell’ambito del corso di Informatica per le Aziende Digitali.
L’obiettivo del progetto è dimostrare la progettazione e l’implementazione di un sistema full-stack API-based applicato a uno scenario realistico del settore finanziario.

Contesto applicativo:

Lo scenario di riferimento è una piccola impresa di consulenza finanziaria che gestisce relazioni con clienti interessati a servizi come ad esempio:

* pianificazione finanziaria,
* accumulo di capitale,
* investimenti a medio/lungo termine.

L’applicazione consente:

* ai "clienti" di registrarsi, compilare il proprio profilo e inviare richieste di consulenza;
* ai "consulenti (advisor)" di visualizzare, filtrare e gestire le richieste, aggiornandone lo stato e consultandone lo storico.

Architettura generale:

Il sistema è basato su un’architettura API-based, con separazione tra:

* front-end (interfaccia utente),
* back-end (logica applicativa),
* database (persistenza dei dati).

Questa scelta ha favorito la modularità, la manutenibilità e l'estendibilità verso future interfacce (es. mobile app o integrazioni esterne varie).


Tecnologie utilizzate:

Back-end:

* Python
* FastAPI (sviluppo API REST)
* SQLAlchemy (ORM)
* SQLite (database relazionale)
* JWT (per autenticazione e autorizzazione)
* Swagger / OpenAPI (per documentazione interattiva delle API)

Front-end:

* HTML5
* CSS3
* JavaScript
* Comunicazione asincrona con le API tramite `fetch`


 La struttura del progetto è la seguente:

Aurora_advisory/
│
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── deps.py
│   └── routers/
│       ├── auth.py
│       ├── profile.py
│       └── requests.py
│
├── frontend/
│   ├── login.html
│   ├── dashboard.html
│   ├── my_requests.html
│   ├── requests_admin.html
│   └── static/
│       ├── css/
│       │   └── styles.css
│       └── js/
│           ├── api.js
│           ├── auth.js
│           ├── dashboard.js
│           ├── my_requests.js
│           └── requests_admin.js
│
└── .gitignore


Le funzionalità principali sono:

Area Cliente:

* Registrazione e login
* Compilazione e aggiornamento del profilo finanziario
* Inserimento di nuove richieste di consulenza
* Visualizzazione dello stato delle richieste
* Consultazione dello storico delle modifiche

Area Consulente (Advisor):

* Accesso riservato
* Visualizzazione di tutte le richieste
* Filtraggio per stato
* Aggiornamento dello stato delle richieste
* Consultazione dello storico associato a ciascuna richiesta


Documentazione API:

Le API REST sono documentate tramite **Swagger** e accessibili all’indirizzo:

```
http://127.0.0.1:8000/docs
```

La documentazione mostra:

* endpoint disponibili (`/auth`, `/profile`, `/requests`);
* parametri richiesti;
* esempi di request e response JSON;
* test interattivi con autenticazione JWT.


Test funzionali:

Il test del prototipo è stato condotto tramite "scenario-based testing", verificando flussi completi end-to-end:

* registrazione → login → compilazione profilo → creazione richiesta;
* gestione richiesta lato consulente;
* aggiornamento stato e verifica storico.

Le evidenze dei test sono documentate tramite screenshot dell’interfaccia web, risposte Swagger e verifica dei dati persistiti nel database, come illustrato e spiegato nell’elaborato.


Stato del progetto:

Il sistema rappresenta un prototipo funzionante a scopo didattico.
Non sono stati implementati test automatici, stress test o verifiche di sicurezza avanzate, che costituirebbero naturali sviluppi futuri in un contesto industriale.


Autore

Progetto sviluppato da Jacopo Tozzo per Unipegaso corso L-31
per finalità didattiche e dimostrative.


