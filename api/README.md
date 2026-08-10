# Download API (gate por e-mail)

Serviço separado (roda no NAS via Docker) que implementa o **gate de download por
e-mail** do site: o interessado informa nome + e-mail, recebe um **link tokenizado** por
e-mail e só então acessa o arquivo. Cada solicitação é registrada no **Postgres** (a
"lista de e-mails").

O site (Astro/GitHub Pages) permanece estático e apenas envia um `POST` (formulário
nativo) para `POST /downloads/request` desta API.

## Stack
Fastify + Postgres (`pg`) + Nodemailer (SMTP). TypeScript rodando via `tsx` (sem etapa de
build em produção).

## Rodar localmente (Docker)
```bash
cp .env.example .env        # ajuste segredos
docker compose up --build   # sobe postgres + api (migrations rodam no boot)
# registrar arquivos (deriva do conteúdo do site; ver "Adicionar um arquivo"):
docker compose exec api npm run seed
curl localhost:3000/health  # {"status":"ok"}
```

## Endpoints
- `GET /health` — liveness.
- `POST /downloads/request` — body `file_id`, `name`, `email`, `consent`, `locale?`
  (form-urlencoded). Grava o lead, gera token (validade `TOKEN_TTL_HOURS`) e envia o link
  por e-mail. Responde página de confirmação.
- `GET /downloads/:token` — valida o token e serve o arquivo do storage privado.
- `GET /admin/leads.csv` — exporta a lista (CSV). Requer header
  `Authorization: Bearer $ADMIN_TOKEN`.

## Modelo de dados
- `files` — registro dos arquivos, **derivado do conteúdo do site** (`id` = `fileId`;
  `filename` = `<fileId>.pdf` no storage). Ver "Adicionar um arquivo".
- `download_leads` — `file_id`, `file_title`, `name`, `email`, `requested_at`,
  `token_hash` (nunca o token bruto), `token_expires_at`, `downloaded_at`, `consent_at`.

## Acessar os leads (dados dos formulários)
Os formulários preenchidos ficam na tabela **`download_leads`** (Postgres; não há arquivo
avulso — o banco persiste no volume `pgdata`). Duas formas de acesso:

**1. Export CSV (rápido)** — endpoint admin protegido por `ADMIN_TOKEN`:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" localhost:3000/admin/leads.csv -o leads.csv
```

**2. Cliente SQL (ex.: DBeaver)** — o serviço `postgres` **não publica porta** por padrão
(fica só na rede Docker). Use o override versionado **`docker-compose.override.yml`**, que
publica a 5432 **só no loopback** (`127.0.0.1`) da NAS:
```bash
docker compose up -d   # o override é aplicado automaticamente → 127.0.0.1:5432 na NAS
```
No DBeaver, crie uma conexão **PostgreSQL** com **túnel SSH**:
- **Main:** Host `127.0.0.1` · Port `5432` · Database `site_downloads` · Username `site` ·
  Password = `POSTGRES_PASSWORD` do `.env`.
- **SSH (Use SSH Tunnel):** Host = IP/hostname (Tailscale) da NAS · Port `22` · seu usuário
  (senha ou chave).

> A 5432 fica amarrada a `127.0.0.1` — acessível só de dentro da NAS (via o túnel SSH),
> nunca exposta na LAN/internet. **Não** use `- '5432:5432'` (bind `0.0.0.0`) com dados
> pessoais de leads (LGPD). Se rodar o api localmente e já tiver um Postgres na 5432,
> renomeie o override para `docker-compose.dbeaver.yml` e use-o sob demanda com `-f`.

## Adicionar um arquivo para download (gated)
O registro é **derivado do conteúdo do site** (sem lista hardcoded). Fluxo:

1. **Site:** criar/editar o JSON em `src/content/{articles,keynotes,livros,relatorios}/*.json`
   com um campo **`fileId`** (slug único). A presença de `fileId` **ativa o gate**; um campo
   `pdf` (arquivo em `public/`) seria download **aberto** (opt-out).
2. **NAS:** colocar o binário em `storage/` com o nome **`<fileId>.pdf`** (convenção).
3. `docker compose exec api npm run seed` — lê `src/content/**` (montado em `/app/site-content`
   via `CONTENT_DIR`), registra cada `fileId` como `{ id, title (do conteúdo), filename:
   <fileId>.pdf }` e **avisa** se algum binário faltar. Idempotente.
4. Deploy do site (o `PUBLIC_API_URL` já aponta para a API).

> Trocar `src/seed.ts` só é preciso para mudar a lógica de derivação — não para adicionar
> arquivos. Se alterar o código do seed, use `docker compose up -d --build` (a `src/` é
> baked na imagem).

## Segurança / operação
- Token: 256 bits, opaco; no banco guardamos só o **hash SHA-256**.
- Rate limit global (20 / 10 min) no endpoint público.
- Arquivos ficam **fora do site** (volume `./storage`, servido só via token).
- **Segredos** (`APP_SECRET`, `ADMIN_TOKEN`, Postgres, SMTP) vêm do `.env`/secrets — não
  versionados.
- **E-mail/entregabilidade:** `SMTP_HOST` vazio = modo dev (link só logado). Em produção,
  use um relay/smarthost com **SPF/DKIM/DMARC** de `@luizcastilho.com` — mailserver puro
  em IP de NAS tende a cair em spam.

## Deploy no NAS (resumo)
1. `.env` com segredos reais e `DATABASE_URL` do Postgres do NAS.
2. `docker compose up -d --build`.
3. Colocar os `<fileId>.pdf` em `storage/` e `npm run seed` (deriva do conteúdo do site).
4. Expor a API por HTTPS (reverse proxy) e apontar `PUBLIC_API_URL` do site para ela.
