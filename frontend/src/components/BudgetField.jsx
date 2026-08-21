import { useEffect, useMemo, useState } from 'react';
import { currencyService } from '../services/currencyService.js';

function roundBudget(amount) {
  if (amount >= 100_000) return Math.round(amount / 10_000) * 10_000;
  if (amount >= 10_000) return Math.round(amount / 1_000) * 1_000;
  if (amount >= 1_000) return Math.round(amount / 100) * 100;
  return Math.round(amount / 10) * 10;
}

function getRateFromEur(ratesFromEur, currency) {
  const code = currency.toUpperCase();
  return ratesFromEur[code] ?? 1;
}

export function getBudgetLimits(currency, ratesFromEur, eurMin = 500, eurMax = 1_000_000) {
  const rate = getRateFromEur(ratesFromEur, currency);
  const min = roundBudget(eurMin * rate);
  const max = roundBudget(eurMax * rate);
  return { min: Math.max(min, 1), max: Math.max(max, min) };
}

function toSliderValue(budget, min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.round(((Math.log(budget) - minLog) / (maxLog - minLog)) * 100);
}

function fromSliderValue(slider, min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  const value = Math.exp(minLog + (slider / 100) * (maxLog - minLog));
  return Math.min(max, Math.max(min, roundBudget(value)));
}

function formatBudget(amount, currency) {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function BudgetField({
  budget,
  onBudgetChange,
  currency,
  onCurrencyChange,
}) {
  const [currencies, setCurrencies] = useState([{ code: 'EUR', name: 'Euro' }]);
  const [topWorldCurrencies, setTopWorldCurrencies] = useState(['USD', 'EUR', 'JPY', 'GBP', 'CNY']);
  const [ratesFromEur, setRatesFromEur] = useState({ EUR: 1 });

  useEffect(() => {
    currencyService.getCurrencies()
      .then((data) => {
        if (data.currencies?.length) setCurrencies(data.currencies);
        if (data.ratesFromEur) setRatesFromEur(data.ratesFromEur);
        if (data.topWorldCurrencies?.length) setTopWorldCurrencies(data.topWorldCurrencies);
      })
      .catch(() => {});
  }, []);

  const topSet = useMemo(() => new Set(topWorldCurrencies), [topWorldCurrencies]);
  const topCurrencies = useMemo(() => {
    const byCode = new Map(currencies.map((c) => [c.code, c]));
    return topWorldCurrencies.map((code) => byCode.get(code)).filter(Boolean);
  }, [currencies, topWorldCurrencies]);
  const otherCurrencies = useMemo(
    () => currencies.filter((c) => !topSet.has(c.code)),
    [currencies, topSet]
  );

  const limits = useMemo(
    () => getBudgetLimits(currency, ratesFromEur),
    [currency, ratesFromEur]
  );

  useEffect(() => {
    onBudgetChange(limits.min);
  }, [currency, limits.min, onBudgetChange]);

  const handleSliderChange = (value) => {
    const next = fromSliderValue(Number(value), limits.min, limits.max);
    onBudgetChange(next);
  };

  const handleCurrencyChange = (nextCurrency) => {
    onCurrencyChange(nextCurrency);
  };

  const displayBudget = budget ?? limits.min;

  return (
    <div className="space-y-3">
      <label className="label-field">Budget</label>

      <div className="p-4 rounded-xl bg-prune-50 border border-prune-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-2xl font-bold text-prune-900 tabular-nums">
            {formatBudget(displayBudget, currency)}
          </p>
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="input-field sm:max-w-[220px] py-2"
            aria-label="Devise"
          >
            <optgroup label="Principales devises">
              {topCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </optgroup>
            {otherCurrencies.length > 0 && (
              <optgroup label="Autres devises">
                {otherCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <input
            type="range"
            min={0}
            max={100}
            value={toSliderValue(displayBudget, limits.min, limits.max)}
            onChange={(e) => handleSliderChange(e.target.value)}
            className="w-full h-2 rounded-full appearance-none bg-prune-200 accent-topaz-500 cursor-pointer"
            aria-label="Montant du budget"
          />
          <div className="flex justify-between text-xs text-prune-500 mt-1.5">
            <span>{formatBudget(limits.min, currency)}</span>
            <span>{formatBudget(limits.max, currency)}</span>
          </div>
          <p className="text-xs text-prune-400 mt-2">
            Plage équivalente à 500 € – 1 000 000 €
          </p>
        </div>
      </div>
    </div>
  );
}
