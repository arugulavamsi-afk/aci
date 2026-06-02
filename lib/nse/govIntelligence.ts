import rawGovIntel from './gov-intelligence.json';
import { INDUSTRY_TO_SECTOR, SECTOR_TO_CONFIG } from './tailwindConfig';

export interface SectorGovIntel {
  govBoost: number;
  confidence: 'high' | 'medium' | 'low';
  pliSchemes: string[];
  capexPlan: string;
  importSubstitution: string;
  govTargets: string;
  primaryMinistry: string;
  lastSignal: string;
}

export interface GovIntelligence {
  lastUpdated: string;
  extractedBy: string;
  sources: Record<string, string>;
  sectors: Record<string, SectorGovIntel>;
}

export const govIntelligence = rawGovIntel as GovIntelligence;

export function getGovBoost(sector: string, industry: string): number {
  for (const [re, key] of INDUSTRY_TO_SECTOR) {
    if (re.test(industry)) return govIntelligence.sectors[key]?.govBoost ?? 0;
  }
  const fallbackKey = SECTOR_TO_CONFIG[sector];
  return fallbackKey ? (govIntelligence.sectors[fallbackKey]?.govBoost ?? 0) : 0;
}

export function getGovIntel(sector: string, industry: string): SectorGovIntel | null {
  for (const [re, key] of INDUSTRY_TO_SECTOR) {
    if (re.test(industry)) return govIntelligence.sectors[key] ?? null;
  }
  const fallbackKey = SECTOR_TO_CONFIG[sector];
  return fallbackKey ? (govIntelligence.sectors[fallbackKey] ?? null) : null;
}
