# Supabase — configuración

El sistema usa Supabase para **Postgres** (datos + `pgvector`) y **Storage** (audios).

## 1. Crear proyecto

1. Entrá a <https://supabase.com> → **New project**.
2. Elegí región cercana y una contraseña fuerte para la base.
3. Esperá a que termine de aprovisionar.

## 2. Activar extensiones

Las migraciones ya hacen `create extension if not exists vector` y `pgcrypto`, pero podés activarlas también desde **Database → Extensions** (`vector`, `pgcrypto`).

## 3. Crear el bucket de Storage

1. **Storage → New bucket**.
2. Nombre: `whatsapp-media` (debe coincidir con `SUPABASE_STORAGE_BUCKET`).
3. Dejalo **privado**. El backend usa la *service role key*, que ignora RLS.

## 4. Obtener credenciales

En **Project Settings**:

- `DATABASE_URL` → **Database → Connection string → URI** (modo *session*/*transaction*). Para Railway/serverless conviene el **pooler** (puerto 6543).
- `SUPABASE_URL` → **API → Project URL**.
- `SUPABASE_SERVICE_ROLE_KEY` → **API → Project API keys → service_role** (⚠️ secreto, solo backend).

## 5. Ejecutar migraciones

Con `DATABASE_URL` configurado:

```bash
pnpm --filter @wma/db build
pnpm migrate
```

Esto crea todas las tablas (`wa_*`), índices, la función `match_messages` y siembra los settings por defecto (`listen_paused=false`, `send_paused=false`).

> El runner es idempotente: guarda lo aplicado en la tabla `_migrations` y se puede correr varias veces.

## 6. Índice vectorial (opcional, a escala)

`idx_wa_message_embeddings_vector` usa `ivfflat`. Para mejores resultados con muchos vectores, después de cargar datos:

```sql
set maintenance_work_mem = '256MB';
reindex index idx_wa_message_embeddings_vector;
```
