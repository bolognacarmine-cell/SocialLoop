# SocialLoop

**SocialLoop** è una piattaforma SaaS per trasformare i contenuti social in clienti: pubblicazione multipiattaforma, landing page con form, CRM con scoring e segmenti, email nurture, offerte, conversioni e retargeting — tutto in un unico flusso.

Stack: **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · BullMQ + Redis · Tailwind CSS · Zod · jose · Vitest**.

---

## Funzionalità

- **Pubblicazione social** su Instagram, Facebook, LinkedIn, X, TikTok e YouTube tramite adapter modulari.
- **Composer unico**: scrivi una volta, seleziona i canali, programma o pubblica subito.
- **Calendario editoriale** con drag & drop per riprogrammare i contenuti.
- **Landing page builder** a blocchi (hero, testo, immagini, vantaggi, testimonianze, FAQ, CTA, form) con preview live.
- **Form lead** integrati che alimentano automaticamente il CRM.
- **CRM**: lead, score di engagement, tag, segmenti dinamici, timeline eventi.
- **Workflow builder**: trigger → condizione → attesa → azione (email, tag, score, fase, segmento, retargeting, post social, webhook).
- **Email nurture** con template e tracking open/click.
- **Offerte, conversioni e retargeting audience** con attribution per campagna.
- **Analytics** di funnel, campagne e canali.
- **Job log** con retry per tutte le operazioni asincrone.

## Architettura del funnel

```
Contenuto social → Landing page → Form → Lead (score) → Workflow/Email → Offerta → Conversione → Retargeting
```

## Struttura del progetto

```
prisma/
  schema.prisma          # modello dati multi-tenant (Workspace)
  seed.ts                # dati demo
  migrations/            # SQL generato
src/
  app/
    (auth)/              # login / register
    (dashboard)/dashboard # overview, posts, calendar, landing-pages, leads,
                          # workflows, campaigns, analytics, jobs, settings
    (public)/l/[slug]/   # rendering pubblico delle landing page
    api/                 # REST API (auth, social, posts, workflows, ...)
  components/            # UI (builder, composer, CRM, calendario, ...)
  lib/
    auth/ crypto/ social/ queue/ workflows/ leads/ validation/
  worker/                # processori BullMQ + poller post programmati
tests/                   # Vitest
```

## Multi-tenancy

Ogni entità di business appartiene a un `Workspace`. La sessione (JWT httpOnly `socialloop_session`, firmata con `jose`) contiene `userId` e `workspaceId`. L'utente può appartenere a più workspace e cambiare quello attivo dalla sidebar.

## Modalità mock (nessuna credenziale reale)

Di default `MOCK_SOCIAL=true`. Gli adapter OAuth e di pubblicazione sono simulati:

- il flusso di connessione reindirizza a `/api/oauth/{platform}/callback?code=mock-code-...&state=...`;
- la pubblicazione restituisce ID remoti fittizi e aggiorna i target;
- i token (finti) vengono comunque cifrati con AES-256-GCM.

Per passare alla modalità live imposta `MOCK_SOCIAL=false` e configura le variabili OAuth dei provider.

---

## Avvio rapido (locale)

Requisiti: Node 20+, pnpm, PostgreSQL e Redis raggiungibili.

```bash
# 1. Dipendenze
pnpm install

# 2. Configura l'ambiente
cp .env.example .env
# genera i segreti:
#   openssl rand -base64 48   -> AUTH_SECRET
#   openssl rand -hex 32      -> TOKEN_ENCRYPTION_KEY

# 3. Database + seed
pnpm db:push     # oppure: pnpm db:migrate
pnpm db:seed

# 4. App e worker (due terminali)
pnpm dev
pnpm worker
```

Apri http://localhost:3000 e accedi con le credenziali demo:

```
demo@socialloop.local / demo1234
```

> Il worker è **necessario** per pubblicare i post programmati, inviare le email e avanzare i workflow.

## Avvio con Docker

```bash
cp .env.example .env
docker compose up --build
```

Servizi: `postgres`, `redis`, `web` (porta 3000) e `worker`.
Per applicare schema e seed dentro il container:

```bash
docker compose exec web npx prisma db push
docker compose exec web npx prisma db seed
```

---

## Variabili d'ambiente

| Variabile | Descrizione |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL |
| `REDIS_URL` | Connection string Redis (BullMQ + rate limiting) |
| `AUTH_SECRET` | Segreto firma JWT (min 32 caratteri) |
| `TOKEN_ENCRYPTION_KEY` | Chiave AES-256-GCM per i token OAuth (64 hex) |
| `NEXT_PUBLIC_APP_URL` | URL pubblico dell'app (usato per link e webhook) |
| `MOCK_SOCIAL` | `true` per adapter simulati |
| `SEED_DEMO_*` | Credenziali e nome del workspace demo |
| `META_*`, `LINKEDIN_*`, `X_*`, `TIKTOK_*`, `GOOGLE_*` | Credenziali app OAuth (vuote in mock) |

Vedi `.env.example` per l'elenco completo.

## Script

| Script | Azione |
| --- | --- |
| `pnpm dev` | Dev server Next.js |
| `pnpm build` | `prisma generate` + build di produzione |
| `pnpm start` | Avvia il build |
| `pnpm worker` | Avvia i worker BullMQ |
| `pnpm test` | Test Vitest |
| `pnpm typecheck` | Type-check TypeScript |
| `pnpm db:push` | Sincronizza lo schema (dev) |
| `pnpm db:migrate` | Applica le migration |
| `pnpm db:seed` | Dati demo |
| `pnpm setup` | generate + push + seed |

## API (sintesi)

- **Auth**: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`
- **Workspace**: `GET /api/workspaces`, `POST /api/workspaces/{id}/activate`
- **Social**: `GET /api/social/accounts`, `GET /api/social/connect/{platform}`, `POST /api/social/accounts/{id}/refresh`, `DELETE /api/social/accounts/{id}`
- **Post**: `GET/POST /api/posts`, `PATCH/DELETE /api/posts/{id}`, `POST /api/posts/{id}/{publish,schedule,retry,cancel}`
- **Landing**: `GET/POST /api/landing-pages`, `PATCH/DELETE /api/landing-pages/{id}`, `POST /api/landing-pages/{id}/publish`, `POST /api/public/forms/{id}/submit`
- **CRM**: `GET/POST /api/leads`, `PATCH/DELETE /api/leads/{id}`, `POST/DELETE /api/leads/{id}/tags`, `GET/POST /api/tags`, `GET/POST /api/segments`, `POST /api/segments/{id}/evaluate`
- **Automazioni**: `GET/POST /api/workflows`, `PATCH/DELETE /api/workflows/{id}`, `POST /api/workflows/{id}/activate`, `POST /api/workflows/{id}/run`
- **Email**: `GET/POST /api/emails/templates`, `PATCH/DELETE /api/emails/templates/{id}`
- **Offerte/Conversioni**: `GET/POST /api/offers`, `POST /api/conversions`
- **Retargeting**: `GET/POST /api/retargeting`
- **Analytics/Op**: `GET /api/analytics`, `GET /api/jobs`, `POST /api/jobs/{id}/retry`, `GET /api/health`
- **Webhook**: `POST /api/webhooks/social/{platform}`, `POST /api/webhooks/email`

## Sicurezza

- Token OAuth cifrati a riposo con **AES-256-GCM** (`v1.iv.tag.ciphertext`).
- Sessioni JWT **httpOnly**, `sameSite=lax`, `secure` in produzione.
- Rate limiting su login e submission dei form (Redis).
- Validazione di tutte le request con **Zod**.
- In produzione l'app **rifiuta** l'avvio con segreti di default.

## Testing

```bash
pnpm test
```

Copre: cifratura token, valutazione condizioni workflow, scoring lead, utilità e metadata piattaforme.

## Note di produzione

- Imposta `MOCK_SOCIAL=false` e fornisci le credenziali OAuth reali dei provider.
- Configura i webhook social/email per ricevere delivery, open e click.
- Avvia almeno un processo `worker` (scalabile orizzontalmente) accanto a `web`.
