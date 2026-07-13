# Qué Cocino

Aplicación web que propone recetas según los alimentos disponibles, prioriza lo que
vence pronto y actualiza el stock cuando se confirma una comida. Este directorio es
un proyecto **standalone**: no depende de un monorepo ni de carpetas externas.

## Funcionalidad disponible

- Registro e inicio de sesión con Auth.js y credenciales.
- Despensa con alta, edición, agotado y eliminación de productos.
- Carga rápida por texto con IA opcional o parser local.
- Recetas compatibles, filtros por preferencias y porciones del hogar.
- Confirmación de cocción con descuento atómico de ingredientes.
- Historial de comidas.
- Sobras en heladera o freezer, con acciones para consumirlas o eliminarlas.
- Lista de compras y sugerencias de ingredientes que desbloquean recetas.
- Perfil con alergias, intolerancias, gustos y tamaño del hogar.

## Stack

- Next.js 16 y React 19.
- TypeScript, Tailwind CSS 4 y componentes locales.
- PostgreSQL y Prisma ORM.
- Auth.js con sesiones JWT.
- Zod, React Hook Form y Vitest.
- AI SDK con Z.AI u OpenAI opcionales.

## Requisitos

- Node.js 20.9 o superior.
- npm.
- Una base PostgreSQL accesible, local o administrada.

Docker y PostgreSQL no se instalan automáticamente. Si no tenés una base disponible,
la interfaz puede compilarse, pero el registro, el login y los datos no funcionarán
hasta completar `DATABASE_URL`.

## Instalación local

Todos los comandos se ejecutan desde esta carpeta:

```text
C:\Users\felip\Desktop\Feli Web\que-cocino
```

Instalá dependencias y creá la configuración local:

```powershell
npm install
Copy-Item .env.example .env.local
npm run auth:secret
```

El último comando genera un `AUTH_SECRET` criptográficamente seguro dentro de
`.env.local` y no muestra su valor. `.env.local` está ignorado por Git.

Editá únicamente `DATABASE_URL` con una conexión PostgreSQL real. Ejemplo de formato,
sin credenciales válidas:

```dotenv
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@HOST:5432/BASE?sslmode=require"
```

Las variables `ZAI_API_KEY` y `OPENAI_API_KEY` son opcionales. Sin ellas sigue
funcionando el parser determinista para la carga rápida.

## Base de datos

El proyecto incluye una migración inicial versionada. Para una base nueva:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
```

Durante desarrollo, cuando se modifica `prisma/schema.prisma`:

```powershell
npm run db:migrate -- --name descripcion_del_cambio
```

Los scripts Prisma cargan siempre `.env.local`, igual que Next.js. Podés comprobar el
estado con:

```powershell
npm run db:status
```

El seed crea el catálogo, recetas y la cuenta demo:

- Email: `demo@quecocino.app`
- Contraseña: `demo1234`

La cuenta demo es sólo para desarrollo. También se puede crear una cuenta propia en
`/register`.

## Ejecutar

```powershell
npm run dev
```

Abrí `http://localhost:3004`. Para probar un build de producción:

```powershell
npm run build
npm start
```

## Flujo principal

1. Creá una cuenta en `/register` o ingresá con la cuenta demo.
2. Cargá alimentos en **Mi despensa**.
3. Elegí una receta en **Qué cocino**.
4. Confirmá las cantidades utilizadas.
5. Si quedaron porciones, guardalas como sobra en heladera o freezer.
6. Consultá la comida en **Historial** y administrá las sobras desde la despensa.

## API

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/register` | crear una cuenta |
| GET/POST | `/api/inventory` | listar o crear productos |
| PATCH/DELETE | `/api/inventory/:id` | editar, agotar o eliminar |
| POST | `/api/interpret` | interpretar una carga rápida |
| GET | `/api/recipes` | buscar recetas compatibles |
| GET | `/api/recipes/:slug` | obtener el detalle de una receta |
| POST | `/api/recipes/generate` | generar una receta validada |
| POST | `/api/cook` | cocinar y descontar stock |
| PATCH/DELETE | `/api/leftovers/:id` | consumir, editar o eliminar sobras |
| GET/POST | `/api/shopping` | administrar compras |
| PATCH/DELETE | `/api/shopping/:id` | completar o eliminar compras |
| GET | `/api/history` | consultar el historial |
| GET/PATCH | `/api/preferences` | consultar o guardar preferencias |

Las rutas privadas obtienen el usuario desde la sesión; no confían en un `userId`
enviado por el navegador. Los cuerpos se validan con Zod.

## Verificación

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Las pruebas unitarias no necesitan base de datos. El flujo completo en ejecución sí
requiere un PostgreSQL válido y migrado.

## Deploy en Vercel

1. Importá este repositorio y usá la raíz del repositorio como **Root Directory**.
2. Configurá `DATABASE_URL`, `AUTH_SECRET` y `AUTH_URL` en Vercel.
3. Agregá claves de IA sólo si querés habilitar esos proveedores.
4. Ejecutá `npm run db:deploy` y `npm run db:seed` desde un entorno autorizado que
   apunte a la base de producción.
5. Usá `npm run build` como Build Command.

No subas `.env.local` ni reutilices el secreto local en producción.
