const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const bearerSecurity = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Collaborative Task Management API',
    version: '1.0.0',
    description:
      'Assign collaborative tasks, complete individual assignments, archive finished tasks, and inspect webhook delivery attempts.',
  },
  servers: [{ url: '/', description: 'Current server' }],
  tags: [{ name: 'System' }, { name: 'Authentication' }, { name: 'Users' }, { name: 'Tasks' }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check application health',
        responses: { 200: { description: 'Application is running' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginInput' },
              example: { email: 'admin@example.com', password: 'Admin123!' },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated' },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Return the authenticated user',
        security: bearerSecurity,
        responses: { 200: { description: 'Current user' }, 401: errorResponse },
      },
    },
    '/users': {
      post: {
        tags: ['Users'],
        summary: 'Create a user (ADMIN)',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserInput' },
            },
          },
        },
        responses: { 201: { description: 'User created' }, 400: errorResponse, 409: errorResponse },
      },
      get: {
        tags: ['Users'],
        summary: 'List users and pending tasks (ADMIN)',
        security: bearerSecurity,
        responses: { 200: { description: 'Registered users' }, 403: errorResponse },
      },
    },
    '/users/{userId}/tasks': {
      get: {
        tags: ['Users'],
        summary: 'List tasks assigned to a user',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/UserId' }],
        responses: {
          200: { description: 'Assigned tasks' },
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/tasks': {
      post: {
        tags: ['Tasks'],
        summary: 'Create a task, optionally with initial assignments (ADMIN)',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } },
          },
        },
        responses: { 201: { description: 'Task created' }, 400: errorResponse, 409: errorResponse },
      },
      get: {
        tags: ['Tasks'],
        summary: 'List tasks (ADMIN)',
        security: bearerSecurity,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'archived'] } },
        ],
        responses: { 200: { description: 'Tasks and assignments' }, 403: errorResponse },
      },
    },
    '/tasks/{idTask}/assign': {
      post: {
        tags: ['Tasks'],
        summary: 'Assign active members to an open task (ADMIN)',
        security: bearerSecurity,
        parameters: [
          { $ref: '#/components/parameters/TaskId' },
          { $ref: '#/components/parameters/IdempotencyKey' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AssignmentInput' } },
          },
        },
        responses: {
          200: { description: 'Members assigned' },
          400: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/tasks/{idTask}/complete': {
      post: {
        tags: ['Tasks'],
        summary: "Complete the authenticated member's assignment",
        security: bearerSecurity,
        parameters: [
          { $ref: '#/components/parameters/TaskId' },
          { $ref: '#/components/parameters/IdempotencyKey' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CompletionInput' } },
          },
        },
        responses: {
          200: { description: 'Assignment completed' },
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/tasks/{idTask}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get a task and its assignments',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/TaskId' }],
        responses: { 200: { description: 'Task details' }, 403: errorResponse, 404: errorResponse },
      },
    },
    '/tasks/{idTask}/notifications': {
      get: {
        tags: ['Tasks'],
        summary: 'List webhook attempts for a task (ADMIN)',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/TaskId' }],
        responses: { 200: { description: 'Notification attempts' }, 404: errorResponse },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      IdempotencyKey: {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', minLength: 8, maxLength: 255 },
      },
      UserId: {
        name: 'userId',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
      },
      TaskId: {
        name: 'idTask',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      UserInput: {
        type: 'object',
        required: ['name', 'lastName', 'email', 'password', 'role'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', maxLength: 80 },
          lastName: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 72 },
          role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
        },
      },
      TaskInput: {
        type: 'object',
        required: ['title'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', maxLength: 100 },
          description: { type: 'string', nullable: true },
          userIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'integer' } },
        },
      },
      AssignmentInput: {
        type: 'object',
        required: ['userIds'],
        properties: {
          userIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'integer' } },
        },
      },
      CompletionInput: {
        type: 'object',
        required: ['userId'],
        properties: { userId: { type: 'integer', minimum: 1 } },
      },
    },
  },
};
