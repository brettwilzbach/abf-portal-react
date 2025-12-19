/**
 * Bloomberg API Proxy Route
 *
 * Proxies requests to the local Bloomberg MCP server.
 * Supports health checks and MCP tool calls.
 */

import { NextRequest, NextResponse } from 'next/server';

const BLOOMBERG_SERVER = process.env.BLOOMBERG_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  // Health check - verify SSE endpoint is responding
  if (endpoint === '/health' || endpoint === 'health') {
    try {
      const controller = new AbortController();
      const response = await fetch(`${BLOOMBERG_SERVER}/sse`, {
        signal: controller.signal,
      });
      controller.abort();
      return NextResponse.json({ available: response.ok, status: 'connected' });
    } catch {
      return NextResponse.json({ available: false, status: 'disconnected' }, { status: 503 });
    }
  }

  // ABS Deals - call the abs_deals MCP tool
  if (endpoint === '/deals' || endpoint === 'deals') {
    const dealType = searchParams.get('type') || 'AUTO';
    const days = parseInt(searchParams.get('days') || '90', 10);
    const screenName = searchParams.get('screen') || '';
    const tickerFile = searchParams.get('ticker_file') || '';

    try {
      const result = await callMcpTool('abs_deals', {
        deal_type: dealType,
        days,
        screen_name: screenName,
        ticker_file: tickerFile
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { deals: [], error: error instanceof Error ? error.message : 'Failed to fetch deals' },
        { status: 503 }
      );
    }
  }

  // ABF News - call the abf_news MCP tool for NI PRIVCRED articles
  if (endpoint === '/news' || endpoint === 'news') {
    const keyword = searchParams.get('keyword') || 'ABF';
    const maxArticles = parseInt(searchParams.get('max') || '10', 10);

    try {
      const result = await callMcpTool('abf_news', { keyword, max_articles: maxArticles });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { articles: [], error: error instanceof Error ? error.message : 'Failed to fetch news' },
        { status: 503 }
      );
    }
  }

  // Generic endpoint passthrough (for future use)
  return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 });
}

/**
 * Call an MCP tool on the Bloomberg server
 * MCP uses JSON-RPC 2.0 over HTTP POST to /messages endpoint
 */
async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  // First, establish SSE connection and get session
  const sseResponse = await fetch(`${BLOOMBERG_SERVER}/sse`, {
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' },
  });

  if (!sseResponse.ok) {
    throw new Error('Failed to connect to Bloomberg MCP server');
  }

  // Read the SSE stream to get the messages endpoint URL
  const reader = sseResponse.body?.getReader();
  if (!reader) throw new Error('No response body');

  let messagesUrl = '';
  const decoder = new TextDecoder();

  // Read SSE events until we get the endpoint event
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('event: endpoint')) {
        // Next data line contains the URL
        continue;
      }
      if (line.startsWith('data: ') && !messagesUrl) {
        const data = line.slice(6).trim();
        if (data.includes('/messages')) {
          messagesUrl = data;
          break;
        }
      }
    }

    if (messagesUrl) break;
  }

  // Cancel the SSE stream
  reader.cancel();

  if (!messagesUrl) {
    // Fallback to default messages endpoint
    messagesUrl = `${BLOOMBERG_SERVER}/messages`;
  }

  // Now call the tool via JSON-RPC
  const rpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const toolResponse = await fetch(messagesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcRequest),
    signal: AbortSignal.timeout(30000),
  });

  if (!toolResponse.ok) {
    throw new Error(`Tool call failed: ${toolResponse.status}`);
  }

  const result = await toolResponse.json();

  // MCP returns result in content array
  if (result.result?.content?.[0]?.text) {
    return JSON.parse(result.result.content[0].text);
  }

  if (result.error) {
    throw new Error(result.error.message || 'Tool call failed');
  }

  return result;
}
