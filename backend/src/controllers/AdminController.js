import { AdminService } from '../services/AdminService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const AdminController = {
  getSettings: asyncHandler(async (req, res) => {
    const settings = await AdminService.getSettings();
    successResponse(res, settings);
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await AdminService.updateSettings(req.body);
    successResponse(res, settings);
  }),

  getPrompts: asyncHandler(async (req, res) => {
    const prompts = await AdminService.getPrompts();
    successResponse(res, prompts);
  }),

  updatePrompt: asyncHandler(async (req, res) => {
    const prompt = await AdminService.updatePrompt(req.params.key, req.body);
    successResponse(res, prompt);
  }),

  getUsers: asyncHandler(async (req, res) => {
    const overview = await AdminService.getUsersOverview();
    successResponse(res, overview);
  }),

  updateUserRole: asyncHandler(async (req, res) => {
    const user = await AdminService.updateUserRole(req.params.id, req.body.role);
    successResponse(res, user);
  }),

  getConnections: asyncHandler(async (req, res) => {
    const connections = await AdminService.getConnections();
    successResponse(res, connections);
  }),
};
