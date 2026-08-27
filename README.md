# Collaborative Task Management API

API REST pequeña para asignar una tarea a varios miembros, registrar la finalización individual de cada uno, archivar la tarea cuando todos terminan y notificar ese evento mediante webhook.

El proyecto usa Node.js, JavaScript con ES Modules, Express, MySQL y SQL directo. No contiene TypeScript, ORM ni paso de compilación.

## Decisiones principales

- Solo existen los roles `ADMIN` y `MEMBER`.
- Un administrador crea usuarios y tareas, asigna miembros y consulta información global.
- Un miembro consulta sus tareas mediante `GET /users/:userId/tasks` y solo puede completar su propia asignación.
- Una tarea puede crearse sin asignados o con `userIds`. Solo usuarios activos con rol `MEMBER` pueden asignarse.
- `tasks.created_by_user_id` se corrigió a `NOT NULL` en el DBML y el esquema SQL: toda tarea nace en una ruta autenticada de administrador, por lo que permitir un creador desconocido contradecía el flujo.
- Un lote de asignación es atómico. Si incluye un usuario inválido o ya asignado, no agrega a ninguno.
- Los `POST` que modifican estado (`/users`, `/tasks`, asignación y finalización) aceptan `Idempotency-Key`. Reutilizarla con la misma ruta, actor y body reproduce la respuesta guardada; cambiar el body devuelve `409`. El login no la necesita porque no modifica el negocio.
- El evento lógico de archivado se crea una sola vez. HTTP no permite garantizar entrega física “exactly once”, por lo que el consumidor recibe una clave estable para deduplicar.
- El webhook se ejecuta después del commit de archivado. Su fallo no revierte una tarea ya archivada.

## Arquitectura

```text
src/
  config/          Environment and MySQL pool
  database/        Migration runner and seeds
  middlewares/     Authentication, validation, errors and idempotency
  modules/
    auth/           Login and current user
    users/          User operations and assigned-task queries
    tasks/          Task workflow and row locking
    notifications/ Webhook delivery and attempt history
  docs/             OpenAPI document
migrations/         Versioned executable SQL
scripts/            Database and local webhook utilities
tests/              MySQL-backed API tests
```

Los controladores/rutas traducen HTTP, los servicios contienen reglas de negocio y los repositorios contienen consultas parametrizadas. No hay interfaces ni capas genéricas.

## Requisitos previos

- Node.js 20.19+, 22.13+ o 24+.
- MySQL 8.0 o posterior.
- Un usuario MySQL con permiso para crear la base indicada en `DB_NAME`.

## Instalación

```bash
npm install
cp .env.example .env
```

En PowerShell, el segundo comando puede reemplazarse por:

```powershell
Copy-Item .env.example .env
```

Edita `.env` antes de continuar. `JWT_SECRET` debe contener al menos 32 caracteres y no debe reutilizarse entre ambientes.

## Variables de entorno

| Variable                  | Descripción                                       | Ejemplo                                |
| ------------------------- | ------------------------------------------------- | -------------------------------------- |
| `NODE_ENV`                | `development`, `test` o `production`              | `development`                          |
| `PORT`                    | Puerto HTTP                                       | `3000`                                 |
| `DB_HOST` / `DB_PORT`     | Servidor MySQL                                    | `127.0.0.1` / `3306`                   |
| `DB_USER` / `DB_PASSWORD` | Credenciales MySQL                                | `app_user` / contraseña local          |
| `DB_NAME`                 | Base de la aplicación                             | `collaborative_task_manager`           |
| `DB_CONNECTION_LIMIT`     | Máximo de conexiones del pool                     | `10`                                   |
| `JWT_SECRET`              | Secreto de firma, mínimo 32 caracteres            | valor aleatorio                        |
| `JWT_EXPIRES_IN`          | Vigencia aceptada por `jsonwebtoken`              | `1h`                                   |
| `NOTIFY_URL`              | Destino del webhook                               | `http://127.0.0.1:4000/webhooks/tasks` |
| `NOTIFY_TIMEOUT_MS`       | Timeout de cada intento                           | `3000`                                 |
| `NOTIFY_RETRY_BASE_MS`    | Base del backoff exponencial                      | `250`                                  |
| `CORS_ORIGIN`             | `*` o lista separada por comas                    | `http://localhost:5173`                |
| `TEST_DB_NAME`            | Base exclusiva de tests; debe terminar en `_test` | `collaborative_task_manager_test`      |

## Base de datos

Crear la base, aplicar migraciones pendientes y cargar seeds:

```bash
npm run db:setup
```

También pueden ejecutarse por separado:

```bash
npm run db:create
npm run db:migrate
npm run db:seed
```

El migrador registra nombre y checksum en `schema_migrations`. Una migración aplicada no puede modificarse silenciosamente.

Los seeds son idempotentes y crean estas credenciales de demostración:

| Rol    | Email                 | Password     |
| ------ | --------------------- | ------------ |
| ADMIN  | `admin@example.com`   | `Admin123!`  |
| MEMBER | `member1@example.com` | `Member123!` |
| MEMBER | `member2@example.com` | `Member123!` |

Son credenciales locales conocidas, no secretos aptos para producción.

## Ejecución

Desarrollo con recarga de Node:

```bash
npm run dev
```

Ejecución normal, sin build previo:

```bash
npm start
```

- Health: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/api/docs`

Swagger incluye autorización Bearer. Inicia sesión, copia `data.accessToken`, pulsa **Authorize** y pega el token.

## Flujo principal con curl

Los ejemplos usan `jq` para extraer valores; también pueden copiarse manualmente desde las respuestas.

### 1. Iniciar sesión como administrador

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}' | jq -r '.data.accessToken')
```

### 2. Consultar miembros y crear una tarea con dos asignados

```bash
curl -s http://localhost:3000/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

TASK_ID=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: create-demo-task-001' \
  -d '{"title":"Prepare release","description":"Complete both reviews","userIds":[2,3]}' \
  | jq -r '.data.task.id')
```

En una base que no sea nueva, usa los IDs devueltos por `GET /users` en vez de asumir `2` y `3`.

También puede crearse primero y asignarse después:

```bash
curl -X POST "http://localhost:3000/tasks/$TASK_ID/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: assign-demo-task-001' \
  -d '{"userIds":[2,3]}'
```

No ejecutes este último ejemplo si esos usuarios ya se incluyeron al crear la tarea: correctamente devolverá `409 DUPLICATE_ASSIGNMENT`.

### 3. Consultar y completar cada asignación

```bash
MEMBER1_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member1@example.com","password":"Member123!"}' | jq -r '.data.accessToken')

MEMBER2_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member2@example.com","password":"Member123!"}' | jq -r '.data.accessToken')

curl "http://localhost:3000/users/2/tasks" \
  -H "Authorization: Bearer $MEMBER1_TOKEN"

curl -X POST "http://localhost:3000/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $MEMBER1_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: complete-member-1-001' \
  -d '{"userId":2}'

curl -X POST "http://localhost:3000/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $MEMBER2_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: complete-member-2-001' \
  -d '{"userId":3}'
```

La primera finalización mantiene `taskStatus: "open"`. La segunda devuelve `taskStatus: "archived"`, fija `archivedAt` y genera la notificación.

### 4. Consultar tarea e intentos de notificación

```bash
curl "http://localhost:3000/tasks/$TASK_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl "http://localhost:3000/tasks/$TASK_ID/notifications" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Webhook

Al archivar se envía:

```http
POST ${NOTIFY_URL}
Content-Type: application/json
X-Idempotency-Key: task.archived:123
```

```json
{
  "taskId": 123,
  "title": "Prepare release",
  "archivedAt": "2026-08-20T20:00:00.000Z"
}
```

Respuestas 2xx marcan la notificación como entregada. Errores de red, timeout o 5xx se reintentan hasta tres veces con backoff. Un 4xx no se reintenta. Cada intento queda en `notification_attempts`.

Para observar el webhook localmente, abre otra terminal:

```bash
npm run webhook:mock
```

Configura `NOTIFY_URL=http://127.0.0.1:4000/webhooks/tasks` y completa la última asignación.

## Pruebas y calidad

La suite crea/migra `TEST_DB_NAME`, que obligatoriamente debe terminar en `_test`, y limpia únicamente sus tablas antes de cada caso. Las credenciales MySQL se toman de `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD`. El usuario necesita permiso `CREATE DATABASE` la primera vez.

```bash
npm test
npm run test:watch
npm run lint
npm run format:check
npm run format
```

El webhook se simula; las pruebas nunca contactan un servicio externo. Se cubren autorización, duplicados, finalización individual, archivado final, concurrencia, idempotencia paralela, reintentos e historial.

## Despliegue

No existe un artefacto de compilación. En cualquier host con Node y acceso a MySQL:

1. Instala dependencias con `npm ci --omit=dev`.
2. Configura todas las variables de `.env.example` en el gestor de secretos del proveedor.
3. Ejecuta `npm run db:migrate` y `npm run db:seed` una vez.
4. Inicia con `npm start` y expón `PORT` mediante HTTPS en el proxy/plataforma.
5. Restringe `CORS_ORIGIN`, usa un `JWT_SECRET` aleatorio y configura una `NOTIFY_URL` HTTPS.

## Limitaciones deliberadas

- No hay refresh tokens, recuperación de contraseña, OAuth, reapertura ni eliminación.
- No hay paginación porque el reto prioriza un conjunto pequeño y un flujo demostrable.
- No hay cola externa ni proceso de reintentos permanente. Los tres intentos ocurren después del archivado dentro de la petición, con timeout acotado.
- Un crash del proceso exactamente después del commit y antes del primer intento puede dejar una notificación `pending`; una solución de producción usaría outbox con worker/cola.
- La clave estable permite deduplicar entregas ambiguas, pero el consumidor debe respetarla porque HTTP por sí solo no ofrece “exactly once”.
- Publicación cloud, repositorio GitHub y video no forman parte de este proyecto local.
