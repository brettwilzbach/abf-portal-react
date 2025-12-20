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
 * Check if Bloomberg MCP server is available
 * Uses the Next.js API proxy to avoid CORS issues
 */
export async function isBloombergAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/bloomberg?endpoint=health', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.available === true;
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
 * Get recent ABS deals from Bloomberg via MCP
 * Uses saved Bloomberg screen for reliable results
 */
export async function getBloombergDeals(
  days: number = 30,
  dealType: string = 'AUTO',
  screenName: string = 'PRIVATE_ABS'
): Promise<BloombergDeal[] | null> {
  try {
    const params = new URLSearchParams({
      endpoint: 'deals',
      type: dealType,
      days: String(days),
      screen: screenName,
    });
    const response = await fetch(`/api/bloomberg?${params}`, {
      signal: AbortSignal.timeout(30000),
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

// =============================================================================
// NEWS
// =============================================================================

export interface ABFNewsArticle {
  headline: string;
  date: string;
  source: string;
  storyId: string;
}

/**
 * Get ABF news from Bloomberg NI PRIVCRED
 */
export async function getABFNews(keyword: string = 'ABF', maxArticles: number = 10): Promise<ABFNewsArticle[] | null> {
  try {
    const response = await fetch(`/api/bloomberg?endpoint=news&keyword=${encodeURIComponent(keyword)}&max=${maxArticles}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.articles ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// SNAPSHOT FUNCTIONALITY
// =============================================================================

export interface BloombergSnapshot {
  timestamp: string;
  spreads: BloombergData | null;
  deals: BloombergDeal[] | null;
  news: ABFNewsArticle[] | null;
}

const SNAPSHOT_KEY = 'bloomberg-snapshot';

/**
 * Save Bloomberg data snapshot to localStorage
 * This allows sharing the portal with people who don't have Bloomberg access
 */
export function saveBloombergSnapshot(snapshot: BloombergSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Failed to save Bloomberg snapshot:', error);
  }
}

/**
 * Load Bloomberg snapshot from localStorage
 */
export function loadBloombergSnapshot(): BloombergSnapshot | null {
  try {
    const data = localStorage.getItem(SNAPSHOT_KEY);
    if (!data) return null;
    return JSON.parse(data) as BloombergSnapshot;
  } catch {
    return null;
  }
}

/**
 * Check if a snapshot exists
 */
export function hasBloombergSnapshot(): boolean {
  return localStorage.getItem(SNAPSHOT_KEY) !== null;
}

/**
 * Get snapshot timestamp in a readable format
 */
export function getSnapshotTimestamp(): string | null {
  const snapshot = loadBloombergSnapshot();
  if (!snapshot) return null;
  try {
    const date = new Date(snapshot.timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return snapshot.timestamp;
  }
}

/**
 * Clear the saved snapshot
 */
export function clearBloombergSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}

/**
 * Export snapshot to a downloadable JSON file
 */
export function exportSnapshotToFile(snapshot: BloombergSnapshot): void {
  const dataStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `abf-portal-snapshot-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import snapshot from a JSON file
 * Returns the parsed snapshot or null if invalid
 */
export function importSnapshotFromJson(jsonString: string): BloombergSnapshot | null {
  try {
    const data = JSON.parse(jsonString);
    // Basic validation
    if (!data.timestamp) return null;
    return data as BloombergSnapshot;
  } catch {
    return null;
  }
}
