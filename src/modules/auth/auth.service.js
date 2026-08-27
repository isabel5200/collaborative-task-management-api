import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../common/errors.js';
import { toIsoString } from '../../common/dates.js';
import * as userRepository from '../users/user.repository.js';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.isActive),
    createdAt: toIsoString(user.createdAt),
  };
}

export async function login(executor, credentials, jwtConfig) {
  const user = await userRepository.findByEmail(executor, credentials.email);
  const validPassword = user
    ? await bcrypt.compare(credentials.password, user.passwordHash)
    : false;

  if (!user || !validPassword || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const accessToken = jwt.sign({ role: user.role }, jwtConfig.secret, {
    subject: String(user.id),
    expiresIn: jwtConfig.expiresIn,
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: jwtConfig.expiresIn,
    user: publicUser(user),
  };
}

export { publicUser };
