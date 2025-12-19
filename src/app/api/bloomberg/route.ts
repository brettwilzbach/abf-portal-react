/**
 * Bloomberg API Proxy Route
 *
 * Proxies requests to the local Bloomberg Python server.
 * This avoids CORS issues and allows the app to work when deployed.
 */

import { NextRequest, NextResponse } from 'next/server';

const BLOOMBERG_SERVER = process.env.BLOOMBERG_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  try {
    // Build the Bloomberg server URL
    const url = new URL(endpoint, BLOOMBERG_SERVER);

    // Forward any additional query params
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Bloomberg server error: ${response.status}`, available: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ ...data, available: true });
  } catch (error) {
    // Bloomberg server not running - return graceful error
    return NextResponse.json(
      {
        error: 'Bloomberg server unavailable',
        available: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      },
      { status: 503 }
    );
  }
}
