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

// Industry regex → config sector key
// Order matters — first match wins. More specific patterns come before broad ones.
export const INDUSTRY_TO_SECTOR: [RegExp, string][] = [
  // Defense & Aerospace
  [/defense|defence|aerospace|naval|ordnance|military|armament/i,                'defense'],
  // Power, Renewable Energy, Green Hydrogen
  [/power\s*(finance|sector|grid|transmission|util)|renewable|solar|wind\s*energy|green\s*hydrogen|hydropower/i, 'power_renewable'],
  // Railways & Metro
  [/railway|rail\s*(infra|vikas)|metro\s*rail|dedicated\s*freight|loco|wagon/i,  'railways'],
  // Semiconductors & Electronics Manufacturing
  [/semiconductor|electronics\s*mfg|pcb|display\s*fab|chip|wafer/i,             'semiconductor'],
  // Water Infrastructure
  [/water\s*(treat|infra|supply|utility)|effluent\s*treat|desalin|sewage/i,      'water_infra'],
  // Roads, Ports, Logistics
  [/road.*construct|highway|port\s*infra|logistics\s*infra|epc.*infra|infra.*construct|toll/i, 'roads_ports_logistics'],
  // Shipbuilding
  [/shipbuild|shipyard|marine\s*(eng|infra|vessel)/i,                            'shipbuilding'],
  // EV & Battery
  [/electric\s*vehicle|ev\s*(component|battery|charging)|battery\s*(cell|pack)|lithium/i, 'ev_mobility'],
  // Pharma & Healthcare
  [/pharma|drug\s*(mfg|discovery)|api\s*mfg|hospital|medical\s*device|diagnostics|biotech/i, 'pharma_healthcare'],
  // Drones & Space
  [/drone|uav|space\s*(tech|satellite|launch)|satellite\s*(comm|launch)/i,       'drone_space'],
  // Telecom Infrastructure
  [/telecom|wireless|mobile\s*(serv|infra)|broadband|fiber\s*optic|tower\s*(infra|co)|dtH/i, 'telecom_infra'],
  // Aviation
  [/aviation|airline|airport|aircraft\s*(mfg|mro)|mro|air\s*transport/i,        'aviation'],
  // Oil & Gas (must come before generic Energy patterns)
  [/oil.*gas|petroleum|refin(ing|ery)|lube|lng|cng|city\s*gas|natural\s*gas|crude/i, 'oil_gas'],
  // Steel & Metals (before generic chemicals)
  [/steel|alumin(ium|um)|copper\s*(smelting|mining|product)|zinc|iron\s*ore|ferro/i, 'steel_metals'],
  // Mining & Critical Minerals
  [/mining|coal\s*(min|india)|mineral|quarr|bauxite|manganese/i,                 'mining'],
  // Textiles & Apparel (specific enough to distinguish from generic manufacturing)
  [/textile|apparel|garment|knit|weav|spinning|yarn|denim|fabric/i,             'textiles'],
  // Specialty Chemicals
  [/specialty\s*chem|agrochemical|fine\s*chem|pigment|dye|fluorochem|adhesive/i, 'specialty_chemicals'],
  // Financial Services
  [/bank|nbfc|insurance|microfinance|housing\s*financ|asset\s*manag|brokerage|mutual\s*fund/i, 'financial_services'],
  // Capital Goods & Heavy Engineering
  [/capital\s*goods|heavy\s*eng|industrial\s*mach|turbine|boiler|compressor|crane/i, 'capital_goods'],
  // Cement & Construction Materials
  [/cement|ready.*mix|concrete|construction\s*mat|tiles|sanitaryware/i,          'steel_metals'],
  // Consumer Services, Hotels, Tourism
  [/hotel|hospitality|resort|tourism|travel\s*(agency|portal)|quick\s*service|restaurant/i, 'consumer_services'],
  // FMCG & Retail
  [/fmcg|consumer\s*goods|packaged\s*food|personal\s*care|household\s*prod|retail\s*chain/i, 'fmcg_retail'],
  // Media & Entertainment
  [/media|broadcast|film|ott|entertainment|print|publish/i,                       'media_entertainment'],
  // General PLI Manufacturing (auto components, food processing, white goods)
  [/auto\s*(comp|mfg|ancill)|food\s*(process|mfg)|consumer\s*electric|white\s*goods/i, 'pli_manufacturing'],
  // Agriculture & Agri inputs
  [/agri|fertiliz|pesticide|irrigation|seed|crop\s*prot/i,                       'agri_food'],
  // Real Estate & Housing Development
  [/real\s*estate|housing\s*develop|property\s*develop/i,                        'real_estate'],
];

// Yahoo Finance sector → config sector key (fallback when no industry pattern matches)
// Corrected: Energy = oil_gas (NOT power_renewable), Basic Materials = metals_mining
export const SECTOR_TO_CONFIG: Record<string, string> = {
  'Industrials':            'capital_goods',
  'Technology':             'digital_it',
  'Healthcare':             'pharma_healthcare',
  'Financial Services':     'financial_services',
  'Energy':                 'oil_gas',          // ONGC/HPCL are oil & gas, not renewables
  'Utilities':              'power_renewable',  // power utilities = grid/transmission
  'Basic Materials':        'steel_metals',     // Steel, cement, metals dominate this bucket
  'Consumer Cyclical':      'pli_manufacturing',
  'Consumer Defensive':     'fmcg_retail',
  'Communication Services': 'telecom_infra',    // Airtel, Jio infra
  'Real Estate':            'real_estate',
};

export function getSectorConfig(sector: string, industry: string): SectorConfig | null {
  // Industry-level match first (more specific)
  for (const [re, key] of INDUSTRY_TO_SECTOR) {
    if (re.test(industry)) return tailwindConfig.sectors[key] ?? null;
  }
  // Sector-level fallback
  const fallbackKey = SECTOR_TO_CONFIG[sector];
  return fallbackKey ? (tailwindConfig.sectors[fallbackKey] ?? null) : null;
}
