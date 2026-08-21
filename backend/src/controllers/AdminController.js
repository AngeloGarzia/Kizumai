import {
  AdminUserResponseDto,
  BroadcastNotificationRequestDto,
  UpsertAppSettingRequestDto,
  UpdatePromptRequestDto,
  UpdateSettingsRequestDto,
  UpdateUserRoleRequestDto,
} from '../dto/admin.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createAdminController({ adminService, notificationService }) {
  return {
    getSettings: asyncHandler(async (req, res) => {
      const settings = await adminService.getSettings();
      successResponse(res, settings);
    }),

    updateSettings: asyncHandler(async (req, res) => {
      const dto = UpdateSettingsRequestDto.from(req.body);
      const settings = await adminService.updateSettings(dto);
      successResponse(res, settings);
    }),

    getSetup: asyncHandler(async (req, res) => {
      const data = await adminService.getSetup();
      successResponse(res, data);
    }),

    upsertAppSetting: asyncHandler(async (req, res) => {
      const dto = UpsertAppSettingRequestDto.from(req.params, req.body);
      const setting = await adminService.upsertAppSetting(dto.key, dto.value);
      successResponse(res, { setting });
    }),

    deleteAppSetting: asyncHandler(async (req, res) => {
      const key = String(req.params.key || '').trim();
      await adminService.deleteAppSetting(key);
      successResponse(res, { deleted: true });
    }),

    getPrompts: asyncHandler(async (req, res) => {
      const prompts = await adminService.getPrompts();
      successResponse(res, prompts);
    }),

    updatePrompt: asyncHandler(async (req, res) => {
      const dto = UpdatePromptRequestDto.from(req.params, req.body);
      const { key, ...payload } = dto;
      const prompt = await adminService.updatePrompt(key, payload);
      successResponse(res, prompt);
    }),

    getUsers: asyncHandler(async (req, res) => {
      const overview = await adminService.getUsersOverview();
      successResponse(res, overview);
    }),

    updateUserRole: asyncHandler(async (req, res) => {
      const dto = UpdateUserRoleRequestDto.from(req.params, req.body);
      const user = await adminService.updateUserRole(dto.id, dto.role, req.user.id);
      successResponse(res, AdminUserResponseDto.from(user));
    }),

    getConnections: asyncHandler(async (req, res) => {
      const connections = await adminService.getConnections();
      successResponse(res, connections);
    }),

    broadcastNotification: asyncHandler(async (req, res) => {
      const dto = BroadcastNotificationRequestDto.from(req.body);
      const summary = await notificationService.broadcast(dto);
      successResponse(res, summary);
    }),
  };
}
