import Fastify from 'fastify';
import cors from '@fastify/cors';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from './routes.js';
import { migrate } from './db/migrate.js';
import {
  NotFoundError,
  OperationError,
  TransactionStateError,
  VersionConflictError,
} from './services/transactions.js';

export async function buildServer() {
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 * 1024 });
  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof VersionConflictError) {
      return reply.code(409).send({
        error: err.message,
        expected: err.expected,
        actual: err.actual,
      });
    }
    if (err instanceof TransactionStateError) return reply.code(409).send({ error: err.message });
    if (err instanceof OperationError) return reply.code(422).send({ error: err.message });
    if (typeof (err as { statusCode?: number }).statusCode === 'number') {
      return reply.code((err as { statusCode: number }).statusCode).send({ error: err.message });
    }
    app.log?.error?.(err);
    console.error(err);
    return reply.code(500).send({ error: 'internal error' });
  });

  await registerRoutes(app);
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  migrate()
    .then(() => buildServer())
    .then((app) => app.listen({ port, host: '0.0.0.0' }))
    .then((addr) => console.log(`digital-dock api listening on ${addr}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
