export function createConnectionService({ connectionRepository }) {
  return {
    async log(req, { userId, email, action }) {
      // L'audit de connexion est accessoire : une panne d'écriture ne doit jamais
      // transformer une authentification réussie en erreur 500.
      try {
        return await connectionRepository.create({
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
      return connectionRepository.findRecent(limit);
    },
  };
}
