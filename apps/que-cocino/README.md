# Qué Cocino — MVP

Qué Cocino propone comidas según los alimentos que una persona realmente tiene en su
casa. Está diseñada mobile-first y separa contratos HTTP, reglas de negocio y acceso a
datos para que una futura app nativa pueda consumir la misma API.

## Estado de esta entrega

El flujo principal está implementado y verificado de extremo a extremo:

1. Inicio de sesión con Auth.js.
2. Alta, edición, agotado y eliminación de productos.
3. Carga rápida por texto con OpenAI o parser local.
4. Revisión editable antes de guardar cualquier interpretación.
5. Conversiones exactas y equivalencias aproximadas por ingrediente.
6. Recetas persistidas y compatibilidad calculada contra el stock.
7. Detalle escalado por cantidad de personas.
8. Confirmación editable de cantidades utilizadas.
9. Descuento atómico sin stock negativo.
10. Historial, sobras, compras y preferencias fit básicas.

No incluye tickets, imágenes, códigos de barras, supermercados, pagos, app nativa ni
nutrición clínica.

## Stack

- Next.js 16, App Router y React 19.
- TypeScript y Tailwind CSS 4.
- Componentes locales basados en las convenciones de shadcn/ui.
- PostgreSQL en Supabase o Neon y Prisma ORM.
- Auth.js con sesiones JWT y credenciales para el MVP.
- AI SDK v6 y proveedores compatibles con OpenAI (Z.AI/GLM prioritario, OpenAI opcional) para salida estructurada.
- Zod para todos los contratos y React Hook Form para formularios.
- Vitest para reglas puras.

## Arquitectura

```text
src/
├── app/                 # rutas, páginas y Route Handlers
├── components/          # shell responsive, pantallas y UI
├── domain/              # conversiones, parser y compatibilidad
├── features/            # casos de uso de inventario, recetas y cocción
├── schemas/             # contratos Zod compartidos
├── server/              # auth, Prisma, autorización y rate limit
└── types/               # extensiones de tipos de dependencias
prisma/
├── schema.prisma        # modelo PostgreSQL
└── seed.ts              # ingredientes, equivalencias, recetas y demo
```

Las páginas son Server Components salvo los formularios y modales interactivos. Las
mutaciones usan Route Handlers para permitir que otro cliente consuma los mismos
contratos. Ningún `userId` enviado por el navegador se utiliza para autorizar datos.

## Configuración local

Requisitos: Node.js 20.9 o superior, pnpm 9 y PostgreSQL.

```bash
corepack enable
pnpm install
cp apps/que-cocino/.env.example apps/que-cocino/.env.local
```

Editá `.env.local`. Si compartís una base con otro proyecto, agregá
`schema=que_cocino` a `DATABASE_URL` para mantener las tablas aisladas.

Prepará la base:

```bash
pnpm --filter que-cocino db:generate
pnpm --filter que-cocino db:push
pnpm --filter que-cocino db:seed
```

Iniciá la aplicación:

```bash
pnpm --filter que-cocino dev
```

Abrí `http://localhost:3004` e ingresá con:

- Email: `demo@quecocino.app`
- Contraseña: `demo1234`

La cuenta es sólo para desarrollo; en producción se debe reemplazar o eliminar.

## IA y funcionamiento sin IA

`POST /api/interpret` recibe texto sanitizado y solicita exclusivamente datos que
cumplen `interpretationSchema`. La respuesta vuelve al navegador para corrección; el
modelo nunca recibe una herramienta de escritura ni acceso a Prisma.

Si existen `ZAI_API_KEY`, `ZAI_BASE_URL` y un modelo GLM, se usa Z.AI/GLM. Si no,
el servidor intenta `OPENAI_API_KEY` como fallback.

Si falta `OPENAI_API_KEY` o la llamada falla, un parser determinista reconoce números,
unidades y alias rioplatenses del catálogo. Inventario, recetas, compras, cocción e
historial funcionan sin IA.

`POST /api/recipes/generate` genera una receta estructurada opcional y también valida
su salida con Zod. Las recetas semilla siguen disponibles sin credenciales externas.

## Consistencia del stock

La confirmación de cocción se ejecuta con aislamiento `Serializable`:

- vuelve a consultar cada lote por `id`, ingrediente y propietario;
- comprueba stock suficiente antes de descontar;
- usa una actualización condicional con `normalizedQuantity >= actualQuantity`;
- crea el evento, los usos y las sobras en la misma transacción;
- revierte todo si una sola cantidad falla.

Las equivalencias caseras se marcan con `≈` y provienen de
`IngredientEquivalence`; no existe una conversión universal para alimentos distintos.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET/POST | `/api/inventory` | listar, crear o confirmar varios productos |
| PATCH/DELETE | `/api/inventory/:id` | editar, agotar o eliminar un producto propio |
| POST | `/api/interpret` | interpretar una frase con salida estructurada |
| GET | `/api/recipes` | filtrar recetas compatibles |
| GET | `/api/recipes/:slug` | detalle y asignación contra lotes reales |
| POST | `/api/recipes/generate` | generar una receta Zod-validada |
| POST | `/api/cook` | confirmar cocción y descontar en transacción |
| GET/POST | `/api/shopping` | listar o agregar compras |
| PATCH/DELETE | `/api/shopping/:id` | comprar y convertir en inventario, o eliminar |
| GET | `/api/history` | consultar comidas anteriores |
| GET/PATCH | `/api/preferences` | leer o guardar preferencias personales |

Todas las rutas privadas derivan el usuario desde la sesión y validan el cuerpo con
Zod. Los endpoints de IA incluyen límite por usuario y proceso. Para múltiples
instancias se recomienda reemplazarlo por Redis/Upstash.

## Verificación

```bash
pnpm --filter que-cocino typecheck
pnpm --filter que-cocino lint
pnpm --filter que-cocino test
pnpm --filter que-cocino build
```

La entrega fue verificada con 4 pruebas unitarias, build de producción, render compacto
en navegador y un E2E real: interpretar → confirmar → compatibilidad 100% → cocinar →
historial.

## Deploy en Vercel

1. Importá el repositorio en Vercel.
2. Seleccioná `apps/que-cocino` como Root Directory.
3. Configurá `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` y, opcionalmente,
   `OPENAI_API_KEY`/`OPENAI_MODEL`.
4. Ejecutá una vez `pnpm --filter que-cocino db:push` y
   `pnpm --filter que-cocino db:seed` desde un entorno con las mismas variables.
5. Usá el Build Command `pnpm build` dentro del Root Directory.

Para producción se recomienda OAuth o magic links, migraciones Prisma versionadas,
rate limiting distribuido, rotación de la cuenta demo y monitoreo de errores.

## Decisiones y próximos pasos

- `Leftover` se conserva como entidad de dominio pero aparece en Mi despensa como
  comida preparada.
- Las recetas generadas no se persisten automáticamente: primero deben ser revisadas.
- El catálogo argentino y sus equivalencias pueden ampliarse sin cambiar el dominio.
- La API queda lista para tickets, imágenes, códigos de barras y un cliente móvil,
  manteniendo siempre confirmación humana antes de modificar stock.
