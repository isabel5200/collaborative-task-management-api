import bcrypt from 'bcryptjs';
import { AppError, isDuplicateEntry } from '../../common/errors.js';
import { toIsoString } from '../../common/dates.js';
import { publicUser } from '../auth/auth.service.js';
import * as userRepository from './user.repository.js';

export async function createUser(executor, input) {
  const roleId = await userRepository.findRoleId(executor, input.role);
  if (!roleId) throw new AppError(400, 'INVALID_ROLE', 'The requested role is not available.');

  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const user = await userRepository.create(executor, {
      ...input,
      roleId,
      passwordHash,
    });
    return publicUser(user);
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new AppError(409, 'DUPLICATE_EMAIL', 'A user with this email already exists.');
    }
    throw error;
  }
}

export async function listUsers(executor) {
  const rows = await userRepository.listWithPendingTasks(executor);
  const users = new Map();

  for (const row of rows) {
    if (!users.has(row.id)) {
      users.set(row.id, {
        id: row.id,
        name: row.name,
        lastName: row.lastName,
        email: row.email,
        role: row.role,
        isActive: Boolean(row.isActive),
        createdAt: toIsoString(row.createdAt),
        pendingTasks: [],
      });
    }
    if (row.taskId) {
      users.get(row.id).pendingTasks.push({
        id: row.taskId,
        title: row.taskTitle,
        status: row.taskStatus,
      });
    }
  }

  return [...users.values()];
}

export async function getUserTasks(executor, userId) {
  const user = await userRepository.findById(executor, userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User was not found.');

  const tasks = await userRepository.listTasksForUser(executor, userId);
  return {
    user: publicUser(user),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assignedAt: toIsoString(task.assignedAt),
      completedAt: toIsoString(task.completedAt),
      completed: Boolean(task.completedAt),
      archivedAt: toIsoString(task.archivedAt),
      createdAt: toIsoString(task.createdAt),
    })),
  };
}

export async function assertAssignableMembers(executor, userIds) {
  const foundIds = await userRepository.findAssignableMembers(executor, userIds);
  if (foundIds.length !== userIds.length) {
    throw new AppError(
      400,
      'INVALID_ASSIGNEES',
      'Every assignee must exist, be active, and have the MEMBER role.',
    );
  }
}
