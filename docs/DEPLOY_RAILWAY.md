# Deploy en Railway

El proyecto corre como **3 servicios** + **Redis**, todos en el mismo proyecto de Railway, apuntando a la misma base de Supabase.

```
Railway project
├── Redis (plugin)
├── listener   (Dockerfile.listener)  + volumen en /app/auth
├── worker     (Dockerfile.worker)
└── dashboard  (Dockerfile.dashboard)
```

## 0. Prerrequisitos

- Supabase listo (ver [SUPABASE.md](./SUPABASE.md)) y migraciones aplicadas.
- `OPENAI_API_KEY` (opcional: sin ella, transcripción/clasificación caen a heurísticas locales).

## 1. Crear el proyecto y Redis

1. **New Project** en Railway.
2. **+ New → Database → Add Redis**. Copiá su `REDIS_URL`.

## 2. Servicio `listener`

1. **+ New → Empty Service** (o deploy desde tu repo).
2. **Settings → Build**: Dockerfile path `docker/Dockerfile.listener`.
3. **Settings → Volumes**: agregá un volumen montado en **`/app/auth`** (conserva la sesión de WhatsApp entre deploys). El contenedor ya define `WA_AUTH_DIR=/app/auth`.
4. **Variables**: ver tabla abajo.
5. Healthcheck path: `/health` (puerto 3001).
6. ⚠️ **Una sola réplica** (regla de seguridad #15: una instancia por número).

## 3. Servicio `worker`

1. Otro servicio, Dockerfile `docker/Dockerfile.worker`.
2. Mismas variables de DB/Redis/OpenAI.
3. Healthcheck `/health` (puerto 3002). No necesita volumen.

## 4. Servicio `dashboard`

1. Otro servicio, Dockerfile `docker/Dockerfile.dashboard`.
2. Variables de DB + auth del panel + `REDIS_URL` (para encolar envíos).
3. Railway le asigna un dominio público (puerto 3000).

## 5. Variables por servicio

| Variable | listener | worker | dashboard |
|---|:--:|:--:|:--:|
| `DATABASE_URL` | ✅ | ✅ | ✅ |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | – |
| `SUPABASE_STORAGE_BUCKET` | ✅ | ✅ | – |
| `REDIS_URL` | ✅ | ✅ | ✅ |
| `OPENAI_API_KEY` (+ modelos) | – | ✅ | – |
| `CONTROL_CHAT_JID`, `OWNER_PHONE` | ✅ | – | – |
| `WA_AUTH_DIR=/app/auth` | ✅ | – | – |
| `ENABLE_AUTO_SEND`, `CONFIRM_BEFORE_SEND`, `ENABLE_AUDIO_*` | ✅ | ✅ | – |
| `APP_SECRET`, `DASHBOARD_USER`, `DASHBOARD_PASSWORD` | – | – | ✅ |

> Tip: usá **Reference Variables** de Railway para compartir `DATABASE_URL` y `REDIS_URL` entre servicios.

## 6. Migraciones en producción

Corré una vez (desde local apuntando a la DB de prod, o con `railway run`):

```bash
pnpm --filter @wma/db build && pnpm migrate
```

## 7. Vincular WhatsApp

1. Abrí los **logs** del servicio `listener`.
2. Aparece un **QR** ASCII. WhatsApp en el teléfono → **Dispositivos vinculados → Vincular dispositivo** → escaneá.
3. El log muestra `WhatsApp connection open`. La sesión queda en el volumen `/app/auth`.

## 8. Verificación

- `GET https://<listener>/health` → `{ ok: true, connected: true }`.
- `GET https://<listener>/status` → estado de conexión.
- Mandate a vos mismo `/status` en WhatsApp (desde el `CONTROL_CHAT_JID`).
- Entrá al dashboard y verificá chats/mensajes.

## Notas

- Si ves `logged out` en los logs, borrá el volumen `/app/auth` y re-vinculá.
- El `worker` puede escalar a varias réplicas; el `listener` **no**.
