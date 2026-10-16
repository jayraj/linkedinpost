import { env } from './env';

export interface SearchHit { title: string; url: string; snippet: string; }

export async function webSearch(query: string, maxResults=5): Promise<SearchHit[]> {
  if (process.env.TAVILY_MCP_URL) {
    try { return await searchViaMcp(query,maxResults); } catch (e) { console.warn('[search] MCP failed, fallback:', e); }
  }
  return await searchViaHttp(query,maxResults);
}

async function searchViaHttp(query: string, maxResults: number): Promise<SearchHit[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('TAVILY_API_KEY')}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic', topic: 'news' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data.results ?? []).map((r:any)=>({ title: r.title, url: r.url, snippet: r.content ?? '' }));
}

async function searchViaMcp(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const transport = new StreamableHTTPClientTransport(new URL(process.env.TAVILY_MCP_URL!));
    const client = new Client({ name: 'agile-post-scout', version: '1.0.0' });
    try {
      await client.connect(transport);
      const out: any = await client.callTool({ name: 'tavily_search', arguments: { query, max_results: maxResults } });
      const text = out?.content?.find((b:any)=>b.type==='text')?.text ?? '[]';
      const parsed = JSON.parse(text);
      return (parsed.results??[]).map((r:any)=>({ title:r.title, url:r.url, snippet:r.content??'' }));
    } finally { await client.close().catch(()=>{}); }
  } catch (e) {
    console.warn('MCP import/transport issue, using HTTP:', e);
    return await searchViaHttp(query,maxResults);
  }
}
