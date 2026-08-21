import { CurrencyResponseDto } from '../dto/currency.dto.js';
import { asyncHandler } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export function createCurrencyController({ currencyService }) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await currencyService.getCurrencyData();
      successResponse(res, CurrencyResponseDto.from(data));
    }),
  };
}
