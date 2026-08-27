import { AppError, isDuplicateEntry } from '../../common/errors.js';
import { toIsoString } from '../../common/dates.js';
import { assertAssignableMembers } from '../users/user.service.js';
import * as taskRepository from './task.repository.js';

function serializeAssignments(assignments) {
  return assignments.map((assignment) => ({
    userId: assignment.userId,
    name: assignment.name,
    lastName: assignment.lastName,
    email: assignment.email,
    assignedAt: toIsoString(assignment.assignedAt),
    completedAt: toIsoString(assignment.completedAt),
    completed: Boolean(assignment.completedAt),
  }));
}

function serializeTask(task, assignments) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    createdByUserId: task.createdByUserId,
    archivedAt: toIsoString(task.archivedAt),
    createdAt: toIsoString(task.createdAt),
    updatedAt: toIsoString(task.updatedAt),
    assignments: serializeAssignments(assignments),
  };
}

async function loadTask(executor, taskId) {
  const task = await taskRepository.findTask(executor, taskId);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
  const assignments = await taskRepository.findAssignments(executor, [taskId]);
  return serializeTask(task, assignments);
}

export function createTaskService(notificationService) {
  async function createTask(executor, input, creatorId) {
    if (input.userIds) await assertAssignableMembers(executor, input.userIds);

    const statusId = await taskRepository.findStatusId(executor, 'open');
    const taskId = await taskRepository.create(executor, {
      title: input.title,
      description: input.description,
      statusId,
      createdByUserId: creatorId,
    });
    if (input.userIds) await taskRepository.addAssignments(executor, taskId, input.userIds);
    return loadTask(executor, taskId);
  }

  async function assignTask(executor, taskId, userIds) {
    const task = await taskRepository.lockTask(executor, taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    if (task.status === 'archived') {
      throw new AppError(409, 'TASK_ARCHIVED', 'Archived tasks cannot receive assignments.');
    }

    await assertAssignableMembers(executor, userIds);
    const existingIds = await taskRepository.findExistingAssignmentIds(executor, taskId, userIds);
    if (existingIds.length > 0) {
      throw new AppError(
        409,
        'DUPLICATE_ASSIGNMENT',
        'At least one user is already assigned to this task.',
      );
    }

    try {
      await taskRepository.addAssignments(executor, taskId, userIds);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new AppError(
          409,
          'DUPLICATE_ASSIGNMENT',
          'At least one user is already assigned to this task.',
        );
      }
      throw error;
    }
    return loadTask(executor, taskId);
  }

  async function completeTask(executor, taskId, authenticatedUserId, requestedUserId) {
    if (authenticatedUserId !== requestedUserId) {
      throw new AppError(403, 'FORBIDDEN', 'Members can only complete their own assignment.');
    }

    const lockedTask = await taskRepository.lockTask(executor, taskId);
    if (!lockedTask) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');

    const assignment = await taskRepository.lockAssignment(executor, taskId, authenticatedUserId);
    if (!assignment) {
      throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'You are not assigned to this task.');
    }

    if (assignment.completedAt) {
      const task = await loadTask(executor, taskId);
      return {
        result: {
          taskId,
          userId: authenticatedUserId,
          completedAt: toIsoString(assignment.completedAt),
          taskStatus: task.status,
          archivedAt: task.archivedAt,
          alreadyCompleted: true,
        },
      };
    }

    const completedAt = await taskRepository.completeAssignment(executor, assignment.id);
    const pendingCount = await taskRepository.countPendingAssignments(executor, taskId);
    let notification = null;

    if (pendingCount === 0) {
      const archived = await taskRepository.archiveIfOpen(executor, taskId);
      if (archived) {
        const archivedTask = await taskRepository.findTask(executor, taskId);
        const notificationId = await taskRepository.createNotification(executor, taskId);
        notification = {
          id: notificationId,
          payload: {
            taskId,
            title: archivedTask.title,
            archivedAt: toIsoString(archivedTask.archivedAt),
          },
        };
      }
    }

    const task = await taskRepository.findTask(executor, taskId);
    return {
      result: {
        taskId,
        userId: authenticatedUserId,
        completedAt: toIsoString(completedAt),
        taskStatus: task.status,
        archivedAt: toIsoString(task.archivedAt),
        alreadyCompleted: false,
      },
      afterCommit: notification
        ? () => notificationService.dispatch(notification.id, notification.payload)
        : null,
    };
  }

  async function getTask(executor, taskId) {
    return loadTask(executor, taskId);
  }

  async function listTasks(executor, status) {
    const tasks = await taskRepository.listTasks(executor, status);
    const assignments = await taskRepository.findAssignments(
      executor,
      tasks.map((task) => task.id),
    );
    return tasks.map((task) =>
      serializeTask(
        task,
        assignments.filter((assignment) => assignment.taskId === task.id),
      ),
    );
  }

  async function assertTaskAccess(executor, taskId, user) {
    const task = await taskRepository.findTask(executor, taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');
    if (user.role === 'ADMIN') return;
    if (!(await taskRepository.isUserAssigned(executor, taskId, user.id))) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot access this task.');
    }
  }

  async function listNotifications(executor, taskId) {
    const task = await taskRepository.findTask(executor, taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task was not found.');

    const rows = await taskRepository.listNotificationAttempts(executor, taskId);
    if (rows.length === 0) return [];

    return [
      {
        notificationId: rows[0].notificationId,
        eventId: `task.archived:${taskId}`,
        status: rows[0].status,
        createdAt: toIsoString(rows[0].createdAt),
        deliveredAt: toIsoString(rows[0].deliveredAt),
        attempts: rows
          .filter((row) => row.attemptNumber !== null)
          .map((row) => ({
            attemptNumber: row.attemptNumber,
            attemptedAt: toIsoString(row.attemptedAt),
            httpStatus: row.httpStatus,
            errorMessage: row.errorMessage,
          })),
      },
    ];
  }

  return {
    createTask,
    assignTask,
    completeTask,
    getTask,
    listTasks,
    assertTaskAccess,
    listNotifications,
  };
}
