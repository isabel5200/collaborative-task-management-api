# Collaborative Task Management API

## Ejecución local

Requisitos: Node.js 20.19+, 22.13+ o 24+, y MySQL 8 con un usuario autorizado para crear bases de datos.

```powershell
npm install
Copy-Item .env.example .env
```

Edita `.env` y configura al menos `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` y `NOTIFY_URL`. El secreto JWT debe tener 32 caracteres como mínimo.

Prepara la base, aplica migraciones registradas y carga los datos de demostración:

```powershell
npm run db:setup
```

Inicia en desarrollo o en modo normal:

```powershell
npm run dev
npm start
```

La documentación y prueba interactiva del contrato HTTP está en `http://localhost:3000/api/docs`. El health check está en `http://localhost:3000/health`.

Credenciales locales creadas por el seed:

- `admin@example.com` / `Admin123!`
- `member1@example.com` / `Member123!`
- `member2@example.com` / `Member123!`

Para observar localmente las notificaciones, configura `NOTIFY_URL=http://127.0.0.1:4000/webhooks/tasks` y ejecuta en otra terminal:

```powershell
npm run webhook:mock
```

Validaciones:

```powershell
npm test
npm run lint
npm run format:check
```

Las pruebas utilizan `TEST_DB_NAME`, cuyo nombre debe terminar en `_test`; nunca reutilizan la base principal.

## Decisiones técnicas justificadas

- JavaScript moderno con ES Modules evita compilación y mantiene el proyecto fácil de revisar.
- Express, MySQL y `mysql2/promise` ofrecen una implementación directa sin ORM. Todo SQL usa parámetros.
- Zod centraliza la validación del entorno y de la entrada HTTP; bcrypt protege contraseñas y JWT resuelve autenticación stateless con expiración.
- La lógica de negocio vive en servicios y el SQL en repositorios. No se añadieron interfaces, fábricas ni capas genéricas.
- Crear usuarios, crear tareas, asignar y completar requieren `Idempotency-Key` porque modifican estado. Login no usa idempotencia porque no altera datos de negocio.
- La clave, ruta, actor y hash canónico del body se registran dentro de la misma transacción que la operación. La restricción única serializa solicitudes paralelas y permite reproducir el mismo status y body.
- La finalización bloquea la tarea con `SELECT ... FOR UPDATE`, modifica solo la asignación autenticada y archiva mediante una transición condicional. El webhook se ejecuta después del commit.
- Cada tarea genera un único evento lógico de archivado. Los intentos HTTP se registran y usan una clave estable para deduplicación, sin prometer entrega física exactamente una vez.

## Supuestos ante ambigüedades

- Solo usuarios activos con rol `MEMBER` pueden recibir tareas; `ADMIN` administra y no completa asignaciones.
- Una tarea puede crearse sin asignados o con una lista no vacía de `userIds`.
- Un lote de asignación es atómico: cualquier usuario inválido o duplicado rechaza el lote completo.
- Una asignación completada y una tarea archivada no pueden reabrirse.
- `tasks.created_by_user_id` es obligatorio porque toda creación exige un administrador autenticado.
- Los errores del webhook no revierten el archivado. Se reintentan timeouts, errores de red y respuestas 5xx hasta tres veces; los 4xx no se reintentan.

## Funcionalidades recortadas por tiempo

- Refresh tokens, recuperación de contraseña, verificación de correo y OAuth.
- Eliminación, reasignación, reapertura, paginación y permisos dinámicos.
- Cola externa o worker persistente para reintentos posteriores a la petición.
- Recuperación automática del pequeño intervalo entre el commit y el primer intento del webhook.
- Docker, CI/CD, infraestructura cloud, despliegue público y video demostrativo.
