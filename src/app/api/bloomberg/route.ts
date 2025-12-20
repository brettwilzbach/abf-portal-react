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
 * MCP uses JSON-RPC 2.0 over HTTP POST to /messages endpoint with SSE for responses
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

  if (!messagesUrl) {
    reader.cancel();
    messagesUrl = `${BLOOMBERG_SERVER}/messages`;
  } else if (messagesUrl.startsWith('/')) {
    messagesUrl = `${BLOOMBERG_SERVER}${messagesUrl}`;
  }

  // Send initialize request first (required by MCP protocol)
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'abf-portal', version: '1.0.0' },
    },
  };

  await fetch(messagesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initRequest),
  });

  // Wait for initialization response via SSE
  let initComplete = false;
  const startTime = Date.now();
  while (!initComplete && Date.now() - startTime < 5000) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    if (text.includes('"method":"initialize"') || text.includes('"id":1')) {
      initComplete = true;
    }
  }

  // Send initialized notification
  const initializedNotification = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  };

  await fetch(messagesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initializedNotification),
  });

  // Now call the tool via JSON-RPC
  const toolId = Date.now();
  const rpcRequest = {
    jsonrpc: '2.0',
    id: toolId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  await fetch(messagesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcRequest),
    signal: AbortSignal.timeout(30000),
  });

  // Read the SSE stream for the tool response
  const responseStartTime = Date.now();
  while (Date.now() - responseStartTime < 30000) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          // Check if this is our tool response
          if (parsed.id === toolId && parsed.result) {
            reader.cancel();
            // MCP returns result in content array
            if (parsed.result.content?.[0]?.text) {
              return JSON.parse(parsed.result.content[0].text);
            }
            return parsed.result;
          }
          if (parsed.id === toolId && parsed.error) {
            reader.cancel();
            throw new Error(parsed.error.message || 'Tool call failed');
          }
        } catch (e) {
          // Continue reading if parse fails
          if (e instanceof Error && e.message !== 'Tool call failed') continue;
          throw e;
        }
      }
    }
  }

  reader.cancel();
  throw new Error('Tool call timed out');
}
