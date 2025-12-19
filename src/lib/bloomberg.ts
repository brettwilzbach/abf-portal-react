/**
 * Bloomberg API Client
 *
 * Fetches data from the local Bloomberg MCP server (Python).
 * Falls back gracefully when Bloomberg is unavailable.
 */

const BLOOMBERG_API = 'http://localhost:8000';

// =============================================================================
// TYPES
// =============================================================================

export interface BloombergSpread {
  name: string;
  value: number | null;
}

export interface CLOSpreads {
  'CLO AAA': number | null;
  'CLO AA': number | null;
  'CLO A': number | null;
  'CLO BBB': number | null;
  'CLO BB': number | null;
}

export interface CreditIndices {
  'CDX IG': number | null;
  'CDX HY': number | null;
  'LCDX': number | null;
}

export interface BloombergData {
  source: 'bloomberg' | 'estimated';
  timestamp: string;
  clo: CLOSpreads | null;
  indices: CreditIndices | null;
  sofr: number | null;
}

export interface BloombergDeal {
  ticker: string;
  name: string;
  issuer: string;
  issueDate: string;
  dealSize: number;
  spread: number;
  rating: string;
  wal: number;
  collateralType: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Check if Bloomberg server is available
 */
export async function isBloombergAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get SOFR rate from Bloomberg
 */
export async function getBloombergSOFR(): Promise<number | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/market/sofr`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.rate ?? null;
  } catch {
    return null;
  }
}

/**
 * Get CLO spreads from Bloomberg (Palmer Square indices)
 */
export async function getBloombergCLOSpreads(): Promise<CLOSpreads | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/spreads/clo`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get credit indices (CDX, LCDX)
 */
export async function getBloombergCreditIndices(): Promise<CreditIndices | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/spreads/indices`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get all structured credit spreads at once
 */
export async function getBloombergStructuredSpreads(): Promise<BloombergData | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/spreads/all`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get recent ABS deals from Bloomberg MCAL
 */
export async function getBloombergDeals(days: number = 30): Promise<BloombergDeal[] | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/deals/recent?days=${days}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.deals ?? null;
  } catch {
    return null;
  }
}

/**
 * Search for specific deals
 */
export async function searchBloombergDeals(query: string): Promise<BloombergDeal[] | null> {
  try {
    const response = await fetch(`${BLOOMBERG_API}/api/deals/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.deals ?? null;
  } catch {
    return null;
  }
}

/**
 * Get historical spread data
 */
export async function getBloombergHistoricalSpreads(
  ticker: string,
  days: number = 365
): Promise<Array<{ date: string; value: number }> | null> {
  try {
    const response = await fetch(
      `${BLOOMBERG_API}/api/spreads/historical?ticker=${encodeURIComponent(ticker)}&days=${days}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
