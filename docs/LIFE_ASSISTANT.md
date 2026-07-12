# Asistente diario

## Inicio confiable

- Doble clic en `INICIAR-ASISTENTE.bat`, o ejecutar `corepack pnpm assistant`.
- El supervisor inicia listener, worker y dashboard.
- Si uno se cae, lo reinicia automáticamente.
- Al iniciar y cada 24 horas crea un backup comprimido en `backups/`.
- Conserva los últimos 14 backups.

## Dashboard

- `/drafts`: respuestas sugeridas con contexto y estilo personal. Requieren aprobación.
- `/tasks` y `/calendar`: tareas, prioridad, recordatorio, recurrencia y posposición.
- `/finances`: ingresos, gastos, deudas y balance mensual.
- `/usage`: tokens, llamadas y costo estimado por modelo.
- `/settings`: hora del resumen diario y activación de borradores.

## Comandos de WhatsApp

- `Tarea revisar caja mañana a las 10`
- `Tarea subir historias cada semana`
- `Recordame llamar a Juan mañana a las 9`
- `Gasté 15000 en nafta`
- `Cobré 300000 venta`
- `Deuda 50000 seguro`
- `/finanzas`
- `/agenda`

## Modelos

- Reglas locales para instrucciones evidentes.
- `glm-4.7-flash` para análisis, tareas, perfiles y borradores.
- `glm-5.2` como respaldo para solicitudes complejas.
- `glm-asr-2512` para transcribir audios.

## Seguridad

- Los borradores nunca se envían sin aprobación.
- Los grupos no reciben respuestas automáticas.
- Cada envío queda auditado en `wa_actions`.
- Las tareas detectadas son idempotentes por mensaje y título.
- Next.js se mantiene en una versión parcheada de la rama 14.
