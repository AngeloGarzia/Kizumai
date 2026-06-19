import { CurrencyService } from '../services/CurrencyService.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const CurrencyController = {
  list: asyncHandler(async (req, res) => {
    const data = await CurrencyService.getCurrencyData();
    successResponse(res, data);
  }),
};
