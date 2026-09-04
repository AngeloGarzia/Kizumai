import { useEffect, useMemo, useState } from 'react';
import { currencyService } from '../services/currencyService.js';

const BUDGET_STEP_EUR = 100;

function getBudgetStep(currency, ratesFromEur, stepEur = BUDGET_STEP_EUR) {
  const rate = getRateFromEur(ratesFromEur, currency);
  const raw = stepEur * rate;
  if (raw >= 5000) return Math.round(raw / 1000) * 1000;
  if (raw >= 500) return Math.round(raw / 100) * 100;
  return Math.max(1, Math.round(raw / 10) * 10);
}

function roundBudget(amount, step = BUDGET_STEP_EUR) {
  if (!Number.isFinite(amount)) return step;
  return Math.round(amount / step) * step;
}

function getRateFromEur(ratesFromEur, currency) {
  const code = currency.toUpperCase();
  return ratesFromEur[code] ?? 1;
}

export function getBudgetLimits(currency, ratesFromEur, eurMin = 500, eurMax = 1_000_000) {
  const rate = getRateFromEur(ratesFromEur, currency);
  const step = getBudgetStep(currency, ratesFromEur);
  const min = roundBudget(eurMin * rate, step);
  const max = roundBudget(eurMax * rate, step);
  return { min: Math.max(min, step), max: Math.max(max, min), step };
}

function toSliderValue(budget, min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.round(((Math.log(budget) - minLog) / (maxLog - minLog)) * 100);
}

function fromSliderValue(slider, min, max, step) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  const value = Math.exp(minLog + (slider / 100) * (maxLog - minLog));
  return Math.min(max, Math.max(min, roundBudget(value, step)));
}

function formatBudgetInput(amount) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
}

function parseBudgetInput(value) {
  const digits = String(value || '').replace(/\s/g, '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function clampBudget(amount, limits) {
  if (amount == null || !Number.isFinite(amount)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, roundBudget(amount, limits.step)));
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
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

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
    const next = fromSliderValue(Number(value), limits.min, limits.max, limits.step);
    onBudgetChange(next);
  };

  const handleCurrencyChange = (nextCurrency) => {
    onCurrencyChange(nextCurrency);
  };

  const displayBudget = budget ?? limits.min;

  useEffect(() => {
    if (!focused) {
      setDraft(formatBudgetInput(displayBudget));
    }
  }, [displayBudget, focused]);

  const commitDraft = () => {
    const next = clampBudget(parseBudgetInput(draft), limits);
    onBudgetChange(next);
    setDraft(formatBudgetInput(next));
    setFocused(false);
  };

  const handleInputChange = (event) => {
    setDraft(event.target.value.replace(/[^\d\s]/g, ''));
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div className="space-y-3">
      <label className="label-field">Budget</label>

      <div className="p-4 rounded-xl bg-prune-50 border border-prune-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label htmlFor="budget-amount" className="text-xs text-prune-500 mb-1 block">
              Montant
            </label>
            <div className="flex items-center gap-2">
              <input
                id="budget-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={focused ? draft : formatBudgetInput(displayBudget)}
                onFocus={() => {
                  setFocused(true);
                  setDraft(String(parseBudgetInput(formatBudgetInput(displayBudget)) ?? displayBudget));
                }}
                onBlur={commitDraft}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                className="input-field text-2xl font-bold text-prune-900 tabular-nums py-2 flex-1 min-w-0"
                aria-label="Montant du budget"
              />
              <span className="text-sm font-medium text-prune-500 shrink-0 pb-2">{currency}</span>
            </div>
          </div>
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
            Saisie libre ou jauge — par pas de 100 € (équivalent 500 € – 1 000 000 €)
          </p>
        </div>
      </div>
    </div>
  );
}
