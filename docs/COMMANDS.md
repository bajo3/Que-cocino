# Guía de comandos

Los comandos se envían **desde el chat de control** (`CONTROL_CHAT_JID`) y solo se ejecutan si el mensaje es tuyo (`fromMe`). Cualquier otro chat se ignora a nivel comandos.

## Comandos exactos

| Comando | Qué hace |
|---|---|
| `/status` | Estado: conexión, escucha, envíos, conteos, último mensaje. |
| `/resumen hoy` | Resumen de los mensajes del día + pendientes detectados. |
| `/clientes calientes` | Lista de contactos con mayor score (leads calientes). |
| `/pendientes` | Tareas/promesas pendientes detectadas. |
| `/sin-responder` | Chats donde el último mensaje es del contacto (les debés respuesta). |
| `/buscar <texto>` | Búsqueda textual en mensajes. |
| `/buscar-audios <texto>` | Búsqueda textual en transcripciones de audio. |
| `/chat <nombre o teléfono>` | Resumen + últimos mensajes de un chat. |
| `/mandar <contacto>: <mensaje>` | Envía a un contacto (si se resuelve sin ambigüedad). |
| `/mandar-grupo <grupo>: <mensaje>` | Envía a un grupo (único comando que permite grupos). |
| `/pausar` | Pausa la **escucha** (deja de ingerir mensajes nuevos). |
| `/reanudar` | Reanuda la escucha. |
| `/pausar-envios` | Bloquea todos los **envíos**. |
| `/reanudar-envios` | Habilita los envíos. |

## Lenguaje natural (envíos)

También entiende órdenes en español:

```
mandale a Juan Pérez que mañana le paso las fotos
avisale a Daniela que ya está lista la documentación
mandale al grupo Ventas que suban foto y video de los vendidos
decile a Héctor Paz que mañana le confirmo lo del Vento
```

El parser arma:

```json
{ "intent": "send_message", "targetType": "contact", "target": "Juan Pérez", "message": "Mañana te paso las fotos.", "confidence": 0.92 }
```

## Resolución de contactos y ambigüedad

- Si el contacto se resuelve con **confianza ≥ 0.85** y es único → envía.
- Si hay **varias coincidencias** → **no envía** y responde pidiendo aclaración:

  ```
  Encontré varios contactos para "Juan":

  1. Juan Pérez - 249...
  2. Juan Taller - 249...
  3. Juan Ranger - 249...

  Respondé con:
  1
  2
  3
  ```

- Si **no se encuentra** → no envía y avisa.

## Reglas que siempre se aplican antes de enviar

1. `ENABLE_AUTO_SEND=true`.
2. `send_paused=false` (no `/pausar-envios`).
3. Mensaje no vacío.
4. Grupos solo con `/mandar-grupo`.
5. Contacto único y confiable.

Cada intento (enviado o bloqueado) queda registrado en `wa_actions`; cada comando en `wa_command_logs`.
