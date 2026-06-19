import { ConnectionModel } from '../models/ConnectionModel.js';

export const ConnectionService = {
  async log(req, { userId, email, action }) {
    return ConnectionModel.create({
      userId,
      email,
      action,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  },

  async getRecentConnections(limit = 100) {
    return ConnectionModel.findRecent(limit);
  },
};
