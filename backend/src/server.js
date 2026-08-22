import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './database/connect.js';
import { startWorker, stopWorker } from './queue/worker.js';
import {
  startDocumentProcessing,
  stopDocumentProcessing,
} from './queue/startDocumentProcessing.js';
import { closeQueues } from './queue/queues.js';
import { closeRedisConnection } from './queue/connection.js';
import { container } from './container/index.js';
import { startProjectMemoryJobs } from './jobs/projectMemoryJobs.js';

await connectDatabase();

// Workers BullMQ (rappels + extraction documents). File locale si pas de Redis.
startWorker();
startDocumentProcessing(container);

const memoryJobs = await startProjectMemoryJobs({
  projectMemoryDecayJob: container.services.projectMemoryDecayJob,
  projectMemorySnapshotService: container.services.projectMemorySnapshotService,
  settingsService: container.services.settingsService,
});

const server = app.listen(config.port, () => {
  console.log(`Serveur Kizumai démarré sur le port ${config.port}`);
  console.log(`Environnement : ${config.nodeEnv}`);
});

async function shutdown(signal) {
  console.log(`\n[server] Signal ${signal} reçu — arrêt en cours...`);
  memoryJobs.stop();
  server.close();
  await stopWorker();
  await stopDocumentProcessing();
  await closeQueues();
  await closeRedisConnection();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
