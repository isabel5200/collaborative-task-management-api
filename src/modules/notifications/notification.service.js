import * as notificationRepository from './notification.repository.js';

const maximumAttempts = 3;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeErrorMessage(error) {
  const message = error?.name === 'AbortError' ? 'Request timed out' : 'Network request failed';
  return message.slice(0, 500);
}

export function createNotificationService({
  pool,
  config,
  fetchImpl = globalThis.fetch,
  sleep = wait,
}) {
  async function dispatch(notificationId, payload) {
    for (let attemptNumber = 1; attemptNumber <= maximumAttempts; attemptNumber += 1) {
      let httpStatus = null;
      let errorMessage = null;
      let shouldRetry;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetchImpl(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `task.archived:${payload.taskId}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        httpStatus = response.status;
        shouldRetry = response.status >= 500;
        if (!response.ok) errorMessage = `Webhook responded with HTTP ${response.status}`;
      } catch (error) {
        errorMessage = safeErrorMessage(error);
        shouldRetry = true;
      } finally {
        clearTimeout(timeout);
      }

      await notificationRepository.recordAttempt(pool, {
        notificationId,
        attemptNumber,
        httpStatus,
        errorMessage,
      });

      if (httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
        await notificationRepository.markDelivered(pool, notificationId);
        return;
      }

      if (!shouldRetry || attemptNumber === maximumAttempts) {
        await notificationRepository.markFailed(pool, notificationId);
        return;
      }

      await sleep(config.retryBaseMs * 2 ** (attemptNumber - 1));
    }
  }

  return { dispatch };
}
