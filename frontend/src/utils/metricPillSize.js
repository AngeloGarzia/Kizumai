/** Tailles partagées des pastilles métriques (concurrence / rentabilité / faisabilité). */
export const METRIC_PILL_SIZE = {
  sm: {
    wrap: 'h-[3.25rem] w-[3.25rem] gap-0.5 px-1',
    icon: 'w-5 h-5 shrink-0',
    iconSlot: 'h-5 flex items-center justify-center',
    mid: 'h-4 flex items-end justify-center gap-px',
    foot: 'h-3 flex items-center justify-center text-[8px] font-bold leading-none tracking-tight',
    value: 'text-[12px] font-bold tabular-nums leading-none',
    segBase: 6,
    segStep: 1.4,
    segWidth: 'w-1',
  },
  md: {
    // Ancien h-16 / icône w-3.5 → +2 sur l’échelle Tailwind
    wrap: 'h-[4.5rem] w-[4.5rem] gap-0.5 px-1.5 py-1',
    icon: 'w-[1.375rem] h-[1.375rem] shrink-0',
    iconSlot: 'h-[1.375rem] flex items-center justify-center',
    mid: 'h-6 flex items-end justify-center gap-0.5',
    foot: 'h-3.5 flex items-center justify-center text-[10px] font-bold leading-none tracking-tight',
    value: 'text-[16px] font-bold tabular-nums leading-none',
    segBase: 7,
    segStep: 1.8,
    segWidth: 'w-1',
  },
};

export function metricPillSize(size = 'md') {
  return METRIC_PILL_SIZE[size === 'sm' ? 'sm' : 'md'];
}

/**
 * Durée du clignotement : score haut → rythme un peu plus vif.
 * Retourne des ms pour --pill-pulse-ms.
 */
export function metricPillPulseMs(score) {
  if (score == null || Number.isNaN(Number(score))) return 2800;
  const s = Math.min(100, Math.max(0, Number(score)));
  // 0 → 2.8s ; 100 → 1.4s
  return Math.round(2800 - (s / 100) * 1400);
}
