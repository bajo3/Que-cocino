# Plan de mejora: dashboard, graficos y agente

Fecha: 2026-07-08

Objetivo: hacer que el sistema deje de sentirse como un bot suelto y pase a funcionar como un agente personal ordenado, visual y accionable. Primero finanzas, despues tareas/calendario y audios.

## Principios

- Primero datos reales, despues interpretacion, despues pregunta util.
- Si hay una accion clara, ejecutarla y mostrar como quedo.
- Si falta un dato importante, preguntar una sola cosa concreta.
- En WhatsApp usar reportes compactos y legibles.
- En dashboard usar graficos reales, filtros y vistas mobile cuidadas.
- Evitar respuestas conversacionales cuando hay informacion estructurada disponible.

## Fase 1: Finanzas ordenadas por WhatsApp

Hacer plantillas claras para:

- Resumen del mes.
- Detalle de ingresos.
- Detalle de gastos.
- Deudas pendientes.
- Comparacion contra mes anterior.
- Correcciones de movimientos.

Ejemplo:

```text
Finanzas - Julio

Ingresos
$775.750  Jesus Diaz
$200.000  Lavado C4 Cactus

Total ingresos: $975.750
Gastos: $0
Balance: $975.750

Distribucion
Jesus Diaz        ████████ 80%
Lavado C4         ██ 20%
```

Comandos/frases a soportar:

- `mis finanzas como van`
- `detallame ingresos`
- `de que es ese monto`
- `gastos por categoria`
- `comparame con el mes pasado`
- `corregi el ingreso de X`
- `dividilo en 700k + 50usd y 200k lavado`
- `deshacer ultimo cambio`

## Fase 2: Dashboard financiero visual

Pantalla de finanzas con:

- Cards superiores: ingresos, gastos, balance, deudas.
- Grafico de barras: ingresos vs gastos por dia/semana/mes.
- Donut/torta: ingresos por concepto.
- Donut/torta: gastos por categoria.
- Linea: balance acumulado del mes.
- Tabla compacta con filtros por tipo, categoria, fecha y texto.
- Vista mobile como app: cards apiladas, graficos full width, tabla convertida en lista.

KPIs iniciales:

- Ingresos del mes.
- Gastos del mes.
- Balance.
- Deudas pendientes.
- Mayor ingreso.
- Mayor gasto.
- Promedio diario.
- Proyeccion simple de cierre de mes.

## Fase 3: Agente de finanzas

El agente debe poder:

- Registrar ingresos/gastos/deudas desde texto o audio.
- Separar un movimiento mal cargado en varios conceptos.
- Editar monto, descripcion, categoria y estado.
- Marcar deuda como cobrada/pagada.
- Detectar duplicados antes de registrar.
- Mostrar confirmacion con el resultado real.
- Ofrecer deshacer cuando modifica datos.

Reglas:

- `k` y `m` son pesos argentinos salvo que diga USD/u$s/dolar.
- USD se convierte al dolar blue vigente.
- Si corrige un movimiento existente, actualizar el registro original y agregar los nuevos que falten.
- Nunca inventar conceptos no cargados.

## Fase 4: Tareas y calendario

Mejorar dashboard y WhatsApp para:

- Marcar tareas como hechas desde calendario.
- Marcar pendientes desde calendario.
- Vista diaria/semanal clara.
- Agrupar por vencidas, hoy, proximas y sin fecha.
- Acciones rapidas mobile.
- Recordatorios mas inteligentes.

Frases a soportar:

- `que tengo hoy`
- `que queda pendiente`
- `marca hecha la de lavar c4`
- `pasala para manana`
- `recordame una hora antes`

## Fase 5: Audios

Objetivo: que pueda manejar audios como entrada normal.

- Transcribir audios nuevos.
- Procesar finanzas/tareas desde la transcripcion.
- Mostrar audios en dashboard con estado.
- Reintentar transcripcion fallida cuando haya archivo.
- Avisar si un audio no pudo descargarse.

Frases:

- `busca en audios lavado`
- `que dije en el audio de recien`
- `anota lo del audio como ingreso`

## Fase 6: Nuevas funciones candidatas

Ideas para evaluar:

- Presupuestos por categoria.
- Alertas cuando gasto supera limite.
- Proyeccion de caja a fin de mes.
- Comparacion mes actual vs mes anterior.
- Ranking de conceptos.
- Flujo de caja semanal.
- Cuentas por cobrar y pagar.
- Clientes/personas frecuentes en ingresos/deudas.
- Exportar finanzas a CSV/Excel.
- Reporte semanal automatico por WhatsApp.
- Modo "cierre del dia": ingresos, gastos, pendientes y alertas.
- Busqueda global: mensajes, audios, tareas y finanzas.
- Etiquetas/categorias sugeridas por IA.
- Deteccion de duplicados.
- Deshacer ultimo cambio.
- Auditoria de cambios financieros.
- Adjuntar comprobantes/fotos a movimientos.
- Dashboard de salud: WhatsApp, Redis, DB, worker, cola de audios.

## Prioridad sugerida

1. Finanzas WhatsApp ordenadas y accionables.
2. Dashboard de finanzas con graficos.
3. Correcciones/deshacer en finanzas.
4. Tareas calendario mobile.
5. Audios como entrada de agente.
6. Reportes automaticos y alertas.

## Notas de investigacion

- Las apps de presupuesto actuales suelen priorizar sincronizacion/carga simple, categorizacion, planificacion futura y alertas de vencimientos.
- Los dashboards financieros de negocio priorizan una vista unica de caja, ingresos, gastos, deudas/cobros y KPIs accionables.
- Para el caso de Felipe, conviene mezclar finanzas personales simples con control operativo de negocio: caja, conceptos, deudas, tareas y audios.

