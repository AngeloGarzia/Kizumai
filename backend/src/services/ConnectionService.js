import { ConnectionModel } from '../models/ConnectionModel.js';

export const ConnectionService = {
  async log(req, { userId, email, action }) {
    // L'audit de connexion est accessoire : une panne d'écriture ne doit jamais
    // transformer une authentification réussie en erreur 500.
    try {
      return await ConnectionModel.create({
        userId,
        email,
        action,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (error) {
      console.warn(`[audit] Échec d'enregistrement de connexion (${action}): ${error.message}`);
      return null;
    }
  },

  async getRecentConnections(limit = 100) {
    return ConnectionModel.findRecent(limit);
  },
};
