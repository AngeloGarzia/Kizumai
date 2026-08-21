const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const EUR_BUDGET_MIN = 500;
const EUR_BUDGET_MAX = 1_000_000;

let cache = {
  currencies: null,
  ratesFromEur: null,
  expiresAt: 0,
};

const TOP_WORLD_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'CNY'];

function sortCurrenciesByPriority(currencies) {
  const byCode = new Map(currencies.map((c) => [c.code, c]));
  const top = TOP_WORLD_CURRENCIES
    .map((code) => byCode.get(code))
    .filter(Boolean);
  const topSet = new Set(TOP_WORLD_CURRENCIES);
  const rest = currencies
    .filter((c) => !topSet.has(c.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return [...top, ...rest];
}

const FALLBACK_CURRENCIES = sortCurrenciesByPriority([
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'United States Dollar' },
  { code: 'GBP', name: 'British Pound Sterling' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'MAD', name: 'Moroccan Dirham' },
]);

const FALLBACK_RATES = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.94,
  CAD: 1.47,
  JPY: 163,
  XOF: 655.957,
  MAD: 10.8,
};

function roundBudget(amount) {
  if (amount >= 100_000) return Math.round(amount / 10_000) * 10_000;
  if (amount >= 10_000) return Math.round(amount / 1_000) * 1_000;
  if (amount >= 1_000) return Math.round(amount / 100) * 100;
  return Math.round(amount / 10) * 10;
}

export function getRateFromEur(ratesFromEur, currency) {
  const code = currency.toUpperCase();
  return ratesFromEur[code] ?? ratesFromEur[code.toLowerCase()] ?? 1;
}

export function getBudgetLimits(
  currency,
  ratesFromEur = FALLBACK_RATES,
  eurMin = EUR_BUDGET_MIN,
  eurMax = EUR_BUDGET_MAX
) {
  const rate = getRateFromEur(ratesFromEur, currency);
  const min = roundBudget(eurMin * rate);
  const max = roundBudget(eurMax * rate);
  return { min: Math.max(min, 1), max: Math.max(max, min) };
}

const CURRENCY_REQUEST_TIMEOUT_MS = Number(process.env.CURRENCY_REQUEST_TIMEOUT_MS) || 8_000;

async function fetchWithTimeout(url, timeoutMs = CURRENCY_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCurrencyData() {
  const [currenciesRes, ratesRes] = await Promise.all([
    fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json'),
    fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json'),
  ]);

  if (!currenciesRes.ok || !ratesRes.ok) {
    throw new Error('Currency API unavailable');
  }

  const currenciesData = await currenciesRes.json();
  const ratesData = await ratesRes.json();

  const currencies = sortCurrenciesByPriority(
    Object.entries(currenciesData).map(([code, info]) => ({
      code: code.toUpperCase(),
      name: typeof info === 'string' ? info : info.name,
    }))
  );

  const ratesFromEur = Object.fromEntries(
    Object.entries(ratesData.eur || {}).map(([code, rate]) => [code.toUpperCase(), rate])
  );
  ratesFromEur.EUR = 1;

  return { currencies, ratesFromEur };
}

async function ensureRatesLoaded() {
  if (cache.currencies && cache.ratesFromEur && Date.now() < cache.expiresAt) {
    return cache;
  }
  try {
    const data = await fetchCurrencyData();
    cache = {
      currencies: data.currencies,
      ratesFromEur: data.ratesFromEur,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  } catch {
    return {
      currencies: FALLBACK_CURRENCIES,
      ratesFromEur: FALLBACK_RATES,
    };
  }
  return cache;
}

/** Service monnaie — lit les bornes budget depuis Setup (app_settings) si fourni. */
export function createCurrencyService({ settingsService = null } = {}) {
  async function eurBounds() {
    if (settingsService) {
      const business = await settingsService.getBusinessConfig();
      return {
        budgetEurMin: business.budgetEurMin,
        budgetEurMax: business.budgetEurMax,
      };
    }
    return { budgetEurMin: EUR_BUDGET_MIN, budgetEurMax: EUR_BUDGET_MAX };
  }

  return {
    async getCurrencyData() {
      const data = await ensureRatesLoaded();
      const bounds = await eurBounds();
      return {
        currencies: data.currencies || FALLBACK_CURRENCIES,
        ratesFromEur: data.ratesFromEur || FALLBACK_RATES,
        default: 'EUR',
        topWorldCurrencies: TOP_WORLD_CURRENCIES,
        budgetEurMin: bounds.budgetEurMin,
        budgetEurMax: bounds.budgetEurMax,
      };
    },

    async getBudgetLimits(currency) {
      const data = await ensureRatesLoaded();
      const bounds = await eurBounds();
      return getBudgetLimits(
        currency,
        data.ratesFromEur || FALLBACK_RATES,
        bounds.budgetEurMin,
        bounds.budgetEurMax
      );
    },

    async clampBudget(amount, currency) {
      const { min, max } = await this.getBudgetLimits(currency);
      const n = Math.round(Number(amount));
      if (Number.isNaN(n)) return min;
      return Math.min(max, Math.max(min, n));
    },
  };
}

/** @deprecated Prefer createCurrencyService — kept for imports without DI. */
export const CurrencyService = createCurrencyService();
