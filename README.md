# Collaborative Task Management API

API REST para crear tareas, asignarlas a múltiples usuarios, registrar la finalización individual de cada miembro, archivarlas automáticamente y notificar al sistema cliente.

## Enlaces para evaluación

- [API desplegada](https://collaborative-task-management-api-production.up.railway.app/)
- [Swagger/OpenAPI](https://collaborative-task-management-api-production.up.railway.app/api/docs/)
- [Health check](https://collaborative-task-management-api-production.up.railway.app/health)
- Modelo de datos: [database.dbml](./database.dbml)

## Ejecución local

Requisitos:

- Node.js 20.19+, 22.13+ o 24+.
- MySQL 8.
- Un usuario de MySQL autorizado para crear bases de datos.

Instala las dependencias y crea el archivo de configuración:

```powershell
npm install
Copy-Item .env.example .env
```

En macOS o Linux, utiliza:

```bash
npm install
cp .env.example .env
```

Edita `.env` y configura principalmente `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `NOTIFY_URL` y `TEST_DB_NAME`. El secreto JWT debe tener al menos 32 caracteres y el nombre de la base de pruebas debe terminar en `_test`.

Crea la base de datos, ejecuta las migraciones y carga los usuarios de demostración:

```bash
npm run db:setup
```

Inicia la API con recarga automática durante el desarrollo:

```bash
npm run dev
```

O en modo normal:

```bash
npm start
```

La documentación local se encuentra en `http://localhost:3000/api/docs` y el health check en `http://localhost:3000/health`.

### Credenciales de evaluación

Estas cuentas son exclusivamente para revisar el proyecto:

- **ADMIN:** `admin@example.com` / `Admin123!`
- **MEMBER:** `member1@example.com` / `Member123!`
- **MEMBER:** `member2@example.com` / `Member123!`

Para probar una ruta protegida, inicia sesión mediante `POST /auth/login`. En Swagger, copia `data.accessToken`, presiona **Authorize** y pega el token.

### Notificaciones locales

Configura:

```env
NOTIFY_URL=http://127.0.0.1:4000/webhooks/tasks
```

Después ejecuta el receptor simulado en otra terminal:

```bash
npm run webhook:mock
```

### Pruebas y calidad

```bash
npm test
npm run lint
npm run format:check
```

Las pruebas crean y migran automáticamente la base indicada en `TEST_DB_NAME`; nunca utilizan la base de desarrollo.

## Autenticación e idempotencia

Las rutas protegidas requieren:

```http
Authorization: Bearer <accessToken>
```

Los siguientes endpoints también requieren el header `Idempotency-Key` porque modifican información:

- `POST /users`
- `POST /tasks`
- `POST /tasks/{idTask}/assign`
- `POST /tasks/{idTask}/complete`

Ejemplo:

```http
Idempotency-Key: create-task-550e8400-e29b-41d4-a716-446655440000
```

Cada operación nueva debe utilizar una clave diferente. Si el cliente reintenta exactamente la misma operación, debe reutilizar la clave original; la API reproducirá la respuesta almacenada sin ejecutar nuevamente la operación.

Si falta el header, la API responde `400 IDEMPOTENCY_KEY_REQUIRED`. Si una misma clave se reutiliza en la misma ruta con un body diferente, responde `409 IDEMPOTENCY_CONFLICT`. Login y las peticiones GET no requieren idempotencia. Swagger muestra este header como obligatorio en los endpoints correspondientes.

## Decisiones técnicas importantes

- Se utilizó JavaScript con ES Modules para evitar una etapa de compilación y facilitar la revisión.
- Express, MySQL y `mysql2/promise` permiten una implementación directa con SQL explícito, sin depender de un ORM.
- Zod realiza la validación de variables de entorno, parámetros y cuerpos HTTP.
- La lógica de negocio se separó en servicios y el acceso SQL en repositorios.
- JWT identifica al usuario y el control de roles limita las operaciones de `ADMIN` y `MEMBER`.
- La finalización utiliza una transacción y `SELECT ... FOR UPDATE` para proteger la tarea ante completaciones simultáneas.
- El webhook se ejecuta después del commit para evitar notificar un archivado que no fue confirmado.
- Cada tarea genera un solo evento lógico de archivado; sus diferentes intentos HTTP quedan registrados y utilizan una clave estable.

## Supuestos ante ambigüedades

- Solo usuarios activos con rol `MEMBER` pueden recibir tareas.
- Los administradores gestionan el sistema, pero no reciben ni completan asignaciones.
- Los títulos de las tareas no son únicos; su identificador es el campo `id`.
- Una tarea puede crearse sin usuarios y permanecerá abierta hasta recibir asignaciones.
- Un lote de asignación es atómico: un usuario inválido o duplicado rechaza el lote completo.
- Una asignación completada y una tarea archivada no pueden reabrirse.
- Los errores del webhook no revierten el archivado. Los timeouts, errores de red y respuestas 5xx se reintentan hasta tres veces.

## Funcionalidades recortadas por tiempo

- Refresh tokens, recuperación de contraseña, verificación de correo y OAuth.
- Edición, eliminación, reasignación y reapertura de tareas.
- Paginación y filtros avanzados.
- Cola externa o worker persistente para reanudar notificaciones después de reinicios.
- Pipeline propio de CI/CD.
- Cierre de sesión del usuario.

## Funcionalidad adicional

Se añadió control de acceso basado en los roles `ADMIN` y `MEMBER`. Un administrador puede gestionar usuarios, crear y asignar tareas, consultar información global y revisar notificaciones. Un miembro únicamente puede consultar sus propias asignaciones y completar su participación. Esto aplica el principio de menor privilegio y evita que un usuario modifique información ajena.

## Despliegue

Elegí Railway porque permite integrar el repositorio de GitHub, administrar las
variables de entorno, provisionar MySQL y publicar la API mediante HTTPS sin
configurar manualmente un servidor. Además, sus referencias internas permiten
conectar la API con MySQL sin colocar las credenciales directamente en el código.

Las migraciones se ejecutan antes del despliegue mediante `npm run db:migrate` y
la aplicación inicia con `npm start`. La integración con GitHub facilita actualizar
el servicio cuando se publica una nueva versión del proyecto.