import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './database/connect.js';

await connectDatabase();

app.listen(config.port, () => {
  console.log(`Serveur Myrokai démarré sur le port ${config.port}`);
  console.log(`Environnement : ${config.nodeEnv}`);
});
