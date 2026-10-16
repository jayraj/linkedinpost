import { baseUrl, isDryRun } from '@/lib/env';

export default function Dashboard() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Agile Post Agent · Dashboard</h1>
      <p>DRY_RUN={isDryRun() ? 'true' : 'false'} · BASE_URL={baseUrl()}</p>
      <p>Note: Draft list requires DB access. View logs/emails after first weekly run.</p>
    </main>
  );
}
