/**
 * User CRUD (admin only, PLAN §7.9, §7.7). Passwords are hashed with scrypt;
 * every write is audited by the caller-provided chain.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  UserSchema,
  type User,
} from '@contracts';
import { hashPassword } from '../auth/passwords.js';
import { Actions } from '../auth/rbac.js';
import type { UserRecord } from '../store/types.js';
import { notFound } from '../util/errors.js';
import { authenticate, authorize, parse, setCache, type RouteDeps } from './guards.js';

function toUser(user: UserRecord): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    siteIds: user.siteIds,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function registerUserRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const guards = [authenticate(deps), authorize(deps, Actions.usersManage)];

  app.get('/users', { preHandler: guards }, async (_request, reply) => {
    setCache(reply, 'no-store');
    return (await deps.store.listUsers()).map(toUser);
  });

  app.get<{ Params: { id: string } }>('/users/:id', { preHandler: guards }, async (request) => {
    const user = await deps.store.getUser(request.params.id);
    if (!user) throw notFound('USER_NOT_FOUND', `User ${request.params.id} not found`);
    return parse(UserSchema, toUser(user));
  });

  app.post('/users', { preHandler: guards }, async (request, reply) => {
    const body = parse(CreateUserRequestSchema, request.body ?? {});
    const now = deps.clock();
    const record: UserRecord = {
      id: randomUUID(),
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      roles: body.roles,
      siteIds: body.siteIds,
      createdAt: now,
      updatedAt: now,
    };
    await deps.store.createUser(record);
    await deps.chain.append({
      siteId: record.siteIds[0] ?? deps.config.siteId,
      eventType: 'user.created',
      actorId: request.authUser!.id,
      actorEmail: request.authUser!.email,
      ip: request.ip,
      device: request.headers['user-agent'] ?? null,
      resource: `user:${record.id}`,
      action: 'create',
      before: null,
      after: { email: record.email, roles: record.roles },
    });
    reply.code(201);
    return parse(UserSchema, toUser(record));
  });

  app.put<{ Params: { id: string } }>('/users/:id', { preHandler: guards }, async (request) => {
    const body = parse(UpdateUserRequestSchema, request.body ?? {});
    const updated = await deps.store.updateUser(request.params.id, {
      ...body,
      updatedAt: deps.clock(),
    });
    if (!updated) throw notFound('USER_NOT_FOUND', `User ${request.params.id} not found`);
    await deps.chain.append({
      siteId: updated.siteIds[0] ?? deps.config.siteId,
      eventType: 'user.updated',
      actorId: request.authUser!.id,
      actorEmail: request.authUser!.email,
      ip: request.ip,
      device: request.headers['user-agent'] ?? null,
      resource: `user:${updated.id}`,
      action: 'update',
      before: null,
      after: { email: updated.email, roles: updated.roles },
    });
    return parse(UserSchema, toUser(updated));
  });

  app.delete<{ Params: { id: string } }>('/users/:id', { preHandler: guards }, async (request, reply) => {
    const deleted = await deps.store.deleteUser(request.params.id);
    if (!deleted) throw notFound('USER_NOT_FOUND', `User ${request.params.id} not found`);
    await deps.chain.append({
      siteId: deps.config.siteId,
      eventType: 'user.deleted',
      actorId: request.authUser!.id,
      actorEmail: request.authUser!.email,
      ip: request.ip,
      device: request.headers['user-agent'] ?? null,
      resource: `user:${request.params.id}`,
      action: 'delete',
      before: null,
      after: null,
    });
    reply.code(204).send();
  });
}
