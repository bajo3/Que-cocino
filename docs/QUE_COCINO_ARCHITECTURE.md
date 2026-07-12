# Qué Cocino — alcance y arquitectura del MVP

## Alcance de la primera entrega

El MVP cubre el flujo completo: autenticar un usuario, cargar alimentos manualmente o
desde texto, revisar la interpretación, consultar recetas compatibles, confirmar el
consumo real, descontar stock de manera atómica, registrar el evento y guardar sobras.
También incluye compras, historial, preferencias y un dashboard responsive.

Quedan fuera de alcance tickets, imágenes, códigos de barras, supermercados, pagos,
app nativa, nutrición clínica y agentes múltiples. La API y el dominio no dependen de
la UI web para facilitar una futura app móvil.

## Estructura

```text
apps/que-cocino/
├── prisma/                 # esquema y seed persistente
├── src/app/                # App Router, páginas, handlers y acciones
├── src/components/         # shell y componentes de interfaz
├── src/features/           # casos de uso por dominio
├── src/domain/             # reglas puras: unidades y compatibilidad
├── src/schemas/            # contratos Zod compartidos
├── src/server/             # Prisma, auth, rate limit y autorización
└── src/test/               # fixtures y pruebas de integración
```

Las páginas son Server Components salvo formularios y modales interactivos. Las
mutaciones usan Route Handlers para que el mismo contrato pueda ser consumido por una
app móvil. Ningún identificador recibido del cliente reemplaza el `userId` de sesión.

## Persistencia y consistencia

- PostgreSQL en Neon o Supabase; Prisma es la única capa de acceso a datos.
- Cantidades normalizadas como `Decimal`: gramos, mililitros o unidades.
- Equivalencias domésticas en `IngredientEquivalence`, específicas por ingrediente.
- El consumo se ejecuta en una transacción `Serializable`. Se vuelve a consultar cada
  lote, se comprueba propietario y stock, y se actualiza con una condición que impide
  cantidades negativas. Historial, usos y sobras se guardan en la misma transacción.
- Las recetas semilla son persistentes; la compatibilidad se calcula en el servidor.

## IA y degradación segura

La interpretación usa AI SDK v6 con salida estructurada validada por Zod. La IA solo
propone datos; la confirmación del usuario llama un endpoint separado. Si no existe una
clave/configuración de IA, un parser determinista en español cubre cantidades, alias y
unidades frecuentes. Inventario, recetas semilla, compras e historial funcionan sin IA.

El rate limit inicial es por proceso y usuario. Para varias instancias se debe cambiar
por un almacén compartido (por ejemplo Upstash Redis) sin modificar los handlers.

## Autenticación y seguridad

Auth.js usa sesiones JWT y credenciales en desarrollo; las contraseñas se almacenan con
hash. Los handlers validan sesión, cuerpo con Zod y pertenencia de recursos. Los errores
no filtran claves ni detalles internos. Los límites, sanitización y tamaño máximo se
aplican antes de invocar un modelo.

## Etapas de implementación

1. Configuración, documentación, Prisma y seed.
2. Reglas puras, validadores y pruebas unitarias.
3. Auth, repositorios, endpoints y transacción de cocción.
4. Shell responsive y dashboard.
5. Despensa y carga rápida con confirmación.
6. Sugerencias, receta, consumo, sobras, compras, historial y perfil.
7. Typecheck, lint, tests, build, README y guía de Vercel.

## Riesgos y decisiones pendientes

- Las equivalencias son aproximadas y deben crecer como catálogo curado, nunca como
  conversión universal.
- El fallback local entiende el vocabulario del seed, no lenguaje arbitrario.
- Sin `DATABASE_URL` se pueden verificar esquema, generación y reglas puras, pero no
  ejecutar pruebas de persistencia reales.
- La información nutricional se etiqueta como estimada y no constituye consejo médico.
- Para producción se recomienda OAuth o magic links y rate limiting distribuido.
