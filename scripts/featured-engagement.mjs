const projectId = process.env.POSTHOG_PROJECT_ID;
const apiKey = process.env.POSTHOG_QUERY_API_KEY;

if (!projectId || !/^\d+$/.test(projectId) || !apiKey) {
  console.error('Configure POSTHOG_PROJECT_ID and POSTHOG_QUERY_API_KEY locally to read feature engagement.');
  process.exit(2);
}

const query = `
SELECT
  properties.film_slug AS film,
  properties.feature_since AS featured_since,
  properties.slot AS slot,
  properties.format AS format,
  properties.watch_mode AS watch_mode,
  countIf(properties.action = 'impression') AS impressions,
  countIf(properties.action = 'select') AS selections,
  countIf(properties.action = 'details') AS details_clicks,
  countIf(properties.action = 'watch') AS watch_clicks
FROM events
WHERE event = 'matinee_feature_interaction'
  AND properties.surface = 'matinee'
  AND properties.$host = 'latentmatinee.com'
  AND timestamp >= now() - INTERVAL 28 DAY
GROUP BY film, featured_since, slot, format, watch_mode
ORDER BY featured_since DESC, slot, film
`;

try {
  const response = await fetch(`https://eu.posthog.com/api/projects/${projectId}/query/`, {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', name: 'Latent Matinee featured engagement', query } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`PostHog query returned HTTP ${response.status}.`);
  const { columns, results } = await response.json();
  if (!Array.isArray(columns) || !Array.isArray(results)) throw new Error('Unexpected PostHog query response.');
  const rows = results.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])));
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PostHog query failed.');
  process.exitCode = 1;
}
