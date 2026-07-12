# Conectar WhatsApp (Baileys)

El `listener` se vincula como **dispositivo** (igual que WhatsApp Web), no usa la API oficial de Business.

## Local

1. Configurá `.env` (al menos `DATABASE_URL`, `SUPABASE_*`, `REDIS_URL`, `WA_AUTH_DIR`).
2. Definí el **chat de control**:
   - `OWNER_PHONE=549XXXXXXXXXX` (tu número, formato internacional sin `+`).
   - `CONTROL_CHAT_JID=549XXXXXXXXXX@s.whatsapp.net` (normalmente tu propio número → es el chat "contigo mismo").
3. Levantá el listener:

   ```bash
   pnpm --filter listener dev
   ```

4. Se imprime un **QR** en la terminal. En el teléfono:
   **WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo** → escaneá.
5. Cuando veas `WhatsApp connection open`, ya está. Las credenciales quedan en `WA_AUTH_DIR` (`./.wa_auth` por defecto).

## ¿Cómo funciona el chat de control?

- Cualquier mensaje que **vos** mandes (es `fromMe`) en el chat cuyo JID es `CONTROL_CHAT_JID` se interpreta como **comando**.
- Lo más simple: usá el chat **contigo mismo** (mensajearte a tu propio número). Ese `remoteJid` es tu propio JID.
- Mensajes de clientes/grupos **nunca** se interpretan como comandos ni reciben respuesta automática.

## Persistencia de sesión

- La carpeta `WA_AUTH_DIR` contiene las llaves de la sesión. **No la borres** salvo que quieras re-vincular.
- En Railway, montá un **volumen** en `/app/auth` (ver [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)).
- **Una sola instancia** del listener por número (si corren dos, WhatsApp cierra la sesión).

## Re-vincular

Si la sesión se cae con `loggedOut`:

```bash
rm -rf ./.wa_auth        # o borrá el volumen en Railway
pnpm --filter listener dev
```
y escaneá el QR de nuevo.

## Pairing code (alternativa al QR)

Baileys también soporta *pairing code* (`sock.requestPairingCode(phone)`). El MVP usa QR por simplicidad; el QR es lo recomendado.
