import { api } from './api.js';

export const currencyService = {
  async getCurrencies() {
    const { data } = await api.get('/currencies');
    return data;
  },
};
