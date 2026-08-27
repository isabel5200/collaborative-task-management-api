import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError, isDuplicateEntry } from '../common/errors.js';
import { asyncHandler } from '../common/async-handler.js';

const keySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[\x21-\x7E]+$/);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function requestFingerprint(req) {
  const actor = req.user?.id ?? 'anonymous';
  const canonicalBody = JSON.stringify(canonicalize(req.validated?.body ?? req.body ?? {}));
  return createHash('sha256').update(`${actor}:${canonicalBody}`).digest('hex');
}

export function idempotentPost(pool, operation) {
  return asyncHandler(async (req, res) => {
    const rawKey = req.get('idempotency-key');
    let key = null;
    if (rawKey !== undefined) {
      const parsedKey = keySchema.safeParse(rawKey);
      if (!parsedKey.success) {
        throw new AppError(
          400,
          'INVALID_IDEMPOTENCY_KEY',
          'Idempotency-Key must contain 8 to 255 visible ASCII characters.',
        );
      }
      key = parsedKey.data;
    }

    const requestPath = req.originalUrl.split('?')[0];
    const requestHash = requestFingerprint(req);
    const connection = await pool.getConnection();
    let outcome;

    try {
      await connection.beginTransaction();

      if (key) {
        try {
          await connection.execute(
            `INSERT INTO idempotency_records
              (idempotency_key, request_method, request_path, request_hash, state)
             VALUES (?, ?, ?, ?, 'processing')`,
            [key, req.method, requestPath, requestHash],
          );
        } catch (error) {
          if (!isDuplicateEntry(error)) throw error;

          const [records] = await connection.execute(
            `SELECT request_hash AS requestHash, state, response_status AS responseStatus,
                    response_body AS responseBody
             FROM idempotency_records
             WHERE idempotency_key = ? AND request_method = ? AND request_path = ?
             FOR UPDATE`,
            [key, req.method, requestPath],
          );
          const record = records[0];
          if (!record || record.requestHash !== requestHash) {
            throw new AppError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'This Idempotency-Key was already used with a different request.',
            );
          }
          if (record.state !== 'completed') {
            throw new AppError(
              409,
              'REQUEST_IN_PROGRESS',
              'The original request is still running.',
            );
          }

          await connection.commit();
          return res.status(record.responseStatus).json(record.responseBody);
        }
      }

      outcome = await operation(req, connection);

      if (key) {
        await connection.execute(
          `UPDATE idempotency_records
           SET state = 'completed', response_status = ?, response_body = ?
           WHERE idempotency_key = ? AND request_method = ? AND request_path = ?`,
          [outcome.status, JSON.stringify(outcome.body), key, req.method, requestPath],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (outcome.afterCommit) {
      try {
        await outcome.afterCommit();
      } catch (error) {
        // The durable notification row remains queryable even if unexpected dispatch code fails.
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'Notification dispatch failed',
            code: error.code,
          }),
        );
      }
    }

    return res.status(outcome.status).json(outcome.body);
  });
}
