# Qué Cocino

Aplicación web responsive que transforma el inventario real de una casa en recetas
accionables. El MVP funcional vive en [`apps/que-cocino`](apps/que-cocino) y cubre el
flujo completo:

**agregar alimentos → confirmar interpretación → ver recetas compatibles → cocinar →
descontar stock de forma transaccional → registrar historial y sobras.**

Incluye Next.js App Router, TypeScript, Tailwind CSS, componentes estilo shadcn/ui,
Prisma/PostgreSQL, Auth.js, Zod, React Hook Form y AI SDK con OpenAI más un parser
determinista de respaldo. Consultá la [guía completa](apps/que-cocino/README.md) para
instalación local, seed, credenciales demo, arquitectura, API y deploy en Vercel.

```bash
corepack enable
pnpm install
pnpm --filter que-cocino db:generate
pnpm --filter que-cocino db:push
pnpm --filter que-cocino db:seed
pnpm --filter que-cocino dev
```

La aplicación queda disponible en `http://localhost:3004`.

---

## Otros proyectos del monorepo

# WhatsApp Memory Assistant

Asistente conectado a **tu** WhatsApp vía [Baileys](https://github.com/WhiskeySockets/Baileys) que **escucha, guarda y entiende** tus chats (privados y grupos), transcribe audios, detecta clientes calientes / tareas / pendientes y genera memoria contextual — y **solo envía mensajes cuando vos se lo ordenás explícitamente** desde un chat de control.

> 🔒 **Regla central:** el sistema **nunca** responde automáticamente a clientes ni grupos. Modo normal = escuchar + entender. Modo acción = enviar **solo** bajo orden explícita y validada.

## Arquitectura

Monorepo `pnpm` con TypeScript:

```
apps/
  listener/    # Baileys: conexión, ingestión, comandos del chat de control, envíos
  worker/      # BullMQ: clasificación, tareas, resúmenes, embeddings, transcripción
  dashboard/   # Next.js: panel privado con login
packages/
  shared/      # env (zod), logger, tipos, constantes
  db/          # pg pool, Supabase Storage, migraciones, repos y queries
  ai/          # AIProcessor (OpenAI + heurísticas offline), parser de comandos
  whatsapp/    # extracción de mensajes, ContactResolver, MessageSender, AudioProcessor, buildContext
supabase/migrations/   # SQL (tablas wa_*, pgvector, match_messages)
docker/                # Dockerfile.listener / .worker / .dashboard
docs/                  # Supabase, Railway, conexión WhatsApp, comandos, seguridad
```

**Flujo de datos:** `WhatsApp → listener` (guarda **primero** en Postgres) `→ BullMQ → worker` (IA: clasifica, detecta tareas, resume, embeddings, transcribe). El **dashboard** lee Postgres y encola envíos que **solo el listener** (dueño del socket) ejecuta, pasando por todas las validaciones de seguridad.

### Stack

Node 20+ · TypeScript · `@whiskeysockets/baileys` · Supabase Postgres + Storage · `pgvector` · Redis + BullMQ · OpenAI (transcripción, clasificación, resumen, embeddings) · Next.js · Docker · Railway.

## Correr local

Requisitos: **Node 20+** y **pnpm 9** (`corepack enable` o `npm i -g pnpm`), una base **Postgres** (Supabase), **Redis**, y opcionalmente una **OpenAI API key**.

```bash
# 1. Dependencias
pnpm install

# 2. Configurar entorno
cp .env.example .env   # completá DATABASE_URL, SUPABASE_*, REDIS_URL, CONTROL_CHAT_JID, OWNER_PHONE, OPENAI_API_KEY

# 3. Compilar y migrar la base
pnpm build
pnpm migrate

# 4. Levantar servicios (en terminales separadas)
pnpm --filter listener dev      # imprime el QR para vincular WhatsApp
pnpm --filter worker dev
pnpm --filter dashboard dev      # http://localhost:3003
```

Vinculá el teléfono escaneando el QR (ver [docs/WHATSAPP_CONNECT.md](docs/WHATSAPP_CONNECT.md)). Probá mandándote `/status` a vos mismo.

### Sin credenciales

El proyecto **compila, typechequea y testea sin ninguna credencial**:

```bash
pnpm install && pnpm build && pnpm typecheck && pnpm test
```

- Sin `OPENAI_API_KEY`, el `AIProcessor` cae a **heurísticas en español** (clasificación, detección de promesas, parser de comandos, pseudo-embeddings) — el sistema sigue funcionando offline.
- Sin `DATABASE_URL`/`REDIS_URL`, el dashboard muestra estados vacíos en vez de romperse; el listener/worker requieren esas conexiones para correr de verdad.

## Comandos (desde el chat de control)

`/status` · `/resumen hoy` · `/clientes calientes` · `/pendientes` · `/sin-responder` · `/buscar <texto>` · `/buscar-audios <texto>` · `/chat <nombre|tel>` · `/mandar <contacto>: <msg>` · `/mandar-grupo <grupo>: <msg>` · `/pausar` · `/reanudar` · `/pausar-envios` · `/reanudar-envios`

También entiende lenguaje natural: *“mandale a Juan Pérez que mañana le paso las fotos”*. Detalle completo en [docs/COMMANDS.md](docs/COMMANDS.md).

## Seguridad

Las 19 reglas de la spec están implementadas **en código** (no solo documentadas): no auto-reply, comandos solo desde tu cuenta y el chat de control, validaciones anti-envío (auto-send, pausa, ambigüedad, confianza, mensaje vacío, grupos), auditoría en `wa_actions` / `wa_command_logs`, logs sin contenido, sin secretos en el repo, dashboard con login. Tabla de trazabilidad en [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).

## Deploy (Railway)

3 servicios (listener + worker + dashboard) + Redis, contra Supabase. El listener usa un **volumen en `/app/auth`** para conservar la sesión. Guía paso a paso en [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md) y [docs/SUPABASE.md](docs/SUPABASE.md).

## Scripts

| Script | Acción |
|---|---|
| `pnpm build` | Compila todos los paquetes/apps |
| `pnpm typecheck` | `tsc --noEmit` en todo el monorepo |
| `pnpm test` | Tests (parser de comandos, resolver, validación de envío, clasificación) |
| `pnpm migrate` | Aplica migraciones SQL |
| `pnpm listener` / `worker` / `dashboard` | Arranca cada servicio (build previo) |

## Tests

34 tests cubren los puntos críticos sin red ni credenciales: parser de comandos (slash + NL), scoring/resolución de contactos, las 9 reglas anti-envío, y la clasificación/detección de tareas heurística.

## Estado de aceptación

Verificado en este entorno: `pnpm install`, `pnpm build`, `pnpm typecheck` y `pnpm test` pasan. La vinculación real de WhatsApp, las migraciones y la transcripción requieren credenciales (Supabase/Redis/OpenAI) y están documentadas en `docs/`.
