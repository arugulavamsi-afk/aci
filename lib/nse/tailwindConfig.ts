import rawConfig from './tailwind-config.json';

export interface SectorConfig {
  policyWeight: number;
  allocationCrore: number;
  yoyChangePct: number;
  tailwindStrength: 'very_strong' | 'strong' | 'moderate' | 'weak';
  schemes: string[];
  keyHighlight: string;
}

export interface TailwindConfig {
  lastUpdated: string;
  budgetYear: string;
  presentedOn: string;
  extractedBy: string;
  sourceDocuments: string[];
  sectors: Record<string, SectorConfig>;
}

export const tailwindConfig = rawConfig as TailwindConfig;

// Map sector config keys → industry regex patterns
// Order matters: first match wins
export const INDUSTRY_TO_SECTOR: [RegExp, string][] = [
  [/defense|defence|aerospace|naval|ordnance|military/i,                      'defense'],
  [/power\s*(finance|sector|grid|transmission)|renewable|solar|wind\s*energy|green\s*hydrogen/i, 'power_renewable'],
  [/railway|rail\s*(infra|vikas)|metro\s*rail|dedicated\s*freight/i,          'railways'],
  [/semiconductor|electronics\s*mfg|pcb|display\s*fab/i,                      'semiconductor'],
  [/water\s*(treat|infra|supply|utility)|effluent\s*treat|desalin/i,          'water_infra'],
  [/road|highway|port\s*infra|logistics\s*infra|epc.*infra|infra.*construct/i,'roads_ports_logistics'],
  [/shipbuild|shipyard|marine\s*(eng|infra)/i,                                'shipbuilding'],
  [/electric\s*vehicle|ev\s*(component|battery|charging)|battery\s*(cell|pack)/i, 'ev_mobility'],
  [/pharma|drug\s*mfg|api\s*mfg|hospital|medical\s*device/i,                 'pharma_healthcare'],
  [/drone|uav|space\s*(tech|satellite)|satellite/i,                           'drone_space'],
  [/information\s*tech|software|it\s*service|cloud|cybersec|data\s*(center|centre)|artificial\s*intel/i, 'digital_it'],
  [/specialty\s*chem|agrochemical|fine\s*chem|pigment|dye|fluorochem/i,       'specialty_chemicals'],
  [/bank|nbfc|insurance|microfinance|housing\s*financ|asset\s*manag/i,        'financial_services'],
  [/capital\s*goods|heavy\s*eng|industrial\s*mach|turbine|boiler|compressor/i,'capital_goods'],
  [/auto\s*(comp|mfg)|textile|food\s*(process|mfg)|consumer\s*electric/i,     'pli_manufacturing'],
  [/agri|fertiliz|pesticide|irrigation|seed/i,                                'agri_food'],
  [/real\s*estate|housing\s*develop|construction\s*dev/i,                     'real_estate'],
];

// Yahoo Finance sector name → config sector key fallback
export const SECTOR_TO_CONFIG: Record<string, string> = {
  'Industrials':            'capital_goods',
  'Technology':             'digital_it',
  'Healthcare':             'pharma_healthcare',
  'Financial Services':     'financial_services',
  'Energy':                 'power_renewable',
  'Utilities':              'power_renewable',
  'Basic Materials':        'specialty_chemicals',
  'Consumer Cyclical':      'pli_manufacturing',
  'Consumer Defensive':     'agri_food',
  'Communication Services': 'digital_it',
  'Real Estate':            'real_estate',
};

export function getSectorConfig(sector: string, industry: string): SectorConfig | null {
  for (const [re, key] of INDUSTRY_TO_SECTOR) {
    if (re.test(industry)) return tailwindConfig.sectors[key] ?? null;
  }
  const fallbackKey = SECTOR_TO_CONFIG[sector];
  return fallbackKey ? (tailwindConfig.sectors[fallbackKey] ?? null) : null;
}
