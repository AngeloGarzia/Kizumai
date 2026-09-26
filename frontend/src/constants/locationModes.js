/** Modes d’ancrage territorial d’un business (création). */

import { IconMonitor, IconStore, IconVan } from '../components/icons.jsx';

export const LOCATION_MODE = {
  FIXED: 'fixed',
  NOMADIC: 'nomadic',
  DEMATERIALIZED: 'dematerialized',
};

export const LOCATION_MODE_META = {
  fixed: {
    type: 'fixed',
    shortLabel: 'Ancré',
    stepLabel: 'Lieu',
    Icon: IconStore,
    tileClass: 'border-topaz-300 bg-topaz-50 text-topaz-900 ring-topaz-200',
    chipClass: 'bg-topaz-100 text-topaz-800 border-topaz-300',
    buttonClass: 'bg-topaz-500 hover:bg-topaz-600 text-white',
    iconWrapClass: 'bg-topaz-100 text-topaz-700',
  },
  nomadic: {
    type: 'nomadic',
    shortLabel: 'Nomade',
    stepLabel: 'Mobilité',
    Icon: IconVan,
    tileClass: 'border-wasabi-300 bg-wasabi-50 text-wasabi-900 ring-wasabi-200',
    chipClass: 'bg-wasabi-100 text-wasabi-800 border-wasabi-300',
    buttonClass: 'bg-wasabi-600 hover:bg-wasabi-700 text-white',
    iconWrapClass: 'bg-wasabi-100 text-wasabi-800',
  },
  dematerialized: {
    type: 'dematerialized',
    shortLabel: 'Dématérialisé',
    stepLabel: 'Setup',
    Icon: IconMonitor,
    tileClass: 'border-prune-300 bg-prune-50 text-prune-900 ring-prune-200',
    chipClass: 'bg-prune-100 text-prune-800 border-prune-300',
    buttonClass: 'bg-prune-600 hover:bg-prune-700 text-white',
    iconWrapClass: 'bg-prune-100 text-prune-700',
  },
};

export function ensureBusinessModes(business) {
  if (!business) return [];
  if (Array.isArray(business.modes) && business.modes.length) {
    return business.modes.filter((m) => LOCATION_MODE_META[m?.type]);
  }
  return [
    {
      type: LOCATION_MODE.FIXED,
      label: 'Ancré',
      angle: '',
      feasibility: business.feasibility ?? null,
    },
  ];
}

export function formatMobilityLabel(mobility) {
  if (!mobility?.referenceLabel) return '';
  const parts = [`Nomade · base ${mobility.referenceLabel}`];
  if (mobility.perimeterType === 'distance' && mobility.radiusKm != null) {
    parts.push(`rayon ${mobility.radiusKm} km`);
  } else if (mobility.perimeterType === 'travel_time' && mobility.maxTravelMinutes != null) {
    parts.push(`max ${mobility.maxTravelMinutes} min`);
  } else if (mobility.perimeterType === 'admin' && mobility.adminLabel) {
    parts.push(mobility.adminLabel);
  }
  if (mobility.circuitLabel) {
    parts.push(mobility.circuitLabel);
  } else if (mobility.circuitType && mobility.circuitType !== 'other') {
    parts.push(String(mobility.circuitType).replace(/_/g, ' '));
  }
  return parts.join(' · ');
}

export function formatDigitalSetupLabel(setup) {
  if (!setup) return '';
  const scopeLabels = {
    city: 'ville',
    region: 'région',
    country: 'France',
    eu: 'UE',
    world: 'monde',
  };
  const workLabels = {
    remote: 'télétravail',
    coworking: 'coworking',
    office: 'bureau',
  };
  const hostLabels = {
    cloud_managed: 'cloud managé',
    vps: 'VPS',
    saas_nocode: 'SaaS / no-code',
    other: 'hébergement autre',
  };
  const parts = [
    'Dématérialisé',
    scopeLabels[setup.marketScope] || setup.marketScope,
    workLabels[setup.workMode] || setup.workMode,
    hostLabels[setup.hosting] || setup.hosting,
  ].filter(Boolean);
  if (setup.legalAddress) parts.push(`siège : ${setup.legalAddress}`);
  return parts.join(' · ');
}
