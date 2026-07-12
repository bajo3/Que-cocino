# Checklist de seguridad

Reglas de la spec §6 y dónde se aplican **en código** (no solo documentadas).

| # | Regla | Dónde |
|---|---|---|
| 1 | No responder automáticamente a chats externos | El listener nunca llama `sendMessage` salvo (a) replies al chat de control, (b) órdenes explícitas. No hay auto-reply. `apps/listener/src/handlers.ts` |
| 2 | Solo ejecutar comandos si vienen de mi cuenta | `isControl = norm.fromMe && ...` en `handlers.ts` |
| 3 | Solo comandos desde `CONTROL_CHAT_JID` | `bareJid(chatId) === bareJid(CONTROL_CHAT_JID)` en `handlers.ts` |
| 4 | No enviar si `ENABLE_AUTO_SEND=false` | `validateSend()` → `auto_send_disabled` (`packages/whatsapp/src/sendValidation.ts`) |
| 5 | No enviar si `send_paused=true` | `validateSend()` → `send_paused`; lectura en `MessageSender` |
| 6 | No enviar si hay más de una coincidencia | `validateSend()` → `ambiguous_contact` + `decideResolution()` |
| 7 | No enviar si no se resuelve con confianza alta | umbral `SEND_CONFIDENCE_THRESHOLD=0.85` |
| 8 | No enviar mensajes vacíos | `validateSend()` → `empty_message` |
| 9 | No enviar a grupos salvo `/mandar-grupo` | `validateSend()` → `group_requires_explicit_command` |
| 10 | Registrar cada acción en `wa_actions` | `MessageSender.send()` siempre hace `insertAction` |
| 11 | Registrar cada comando en `wa_command_logs` | `handleControlCommand()` → `insertCommandLog` |
| 12 | No imprimir contenido completo en logs | `safeMessageLog()` + redacción de pino (`packages/shared/src/logger.ts`) |
| 13 | No guardar API keys en código | Todo vía `process.env` validado con zod (`env.ts`); `.env` en `.gitignore` |
| 14 | Proteger dashboard con login | `middleware.ts` + cookie de sesión (`src/lib/auth.ts`) |
| 15 | Una sola instancia del listener por número | Documentado; 1 réplica en Railway; volumen único de auth |
| 16–19 | Comandos `/pausar-envios`, `/reanudar-envios`, `/pausar`, `/reanudar` | `packages/ai/src/commandNlp.ts` + `control.ts` |

## Otros recaudos

- **Primero guardar, después procesar**: `insertMessage` ocurre antes de encolar IA; si la IA falla, el mensaje ya está persistido (spec §21).
- **Fail-safe en envíos**: si no se puede leer `send_paused`, se asume *pausado* (`safeIsSendPaused`).
- **`CONFIRM_BEFORE_SEND`**: gate opcional de confirmación humana antes de enviar.
- **Sin auto-descarga de media**: solo audio por defecto (`ENABLE_AUDIO_DOWNLOAD`); imágenes/videos requieren `ENABLE_MEDIA_DOWNLOAD=true`.
- **Service role key** solo en backend (listener/worker), nunca en el bundle del dashboard.
