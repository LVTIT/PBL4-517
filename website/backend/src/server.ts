import { app } from './app.js';
import { config } from './lib/config.js';
import { closeDatabase, prisma } from './lib/database.js';
import { sessionStore } from './middleware/session.js';

try {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  const server = app.listen(config.PORT, '127.0.0.1', () => {
    console.log(`Backend listening on http://127.0.0.1:${config.PORT}`);
  });

  server.on('error', () => {
    console.error('Cannot start HTTP server. Check PORT and existing processes.');
    sessionStore.close();
    void closeDatabase().finally(() => process.exit(1));
  });

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close(() => {
      sessionStore.close();
      void closeDatabase().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch {
  console.error('Cannot connect to PostgreSQL. Check DATABASE_URL and apply migrations.');
  sessionStore.close();
  await closeDatabase();
  process.exitCode = 1;
}
