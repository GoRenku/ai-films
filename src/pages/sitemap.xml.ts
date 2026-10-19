import type { APIRoute } from 'astro';
import { catalog } from '../lib/catalog';
import { escapeXml } from '../lib/xml';

const FIXED_PAGES = ['/', '/films/', '/artists/', '/whats-new/', '/journal/', '/about/', '/privacy/'];

export const GET: APIRoute = async ({ site }) => {
  const { films, artists, updates } = await catalog();
  const paths = [
    ...FIXED_PAGES,
    ...films.map((f) => `/films/${f.id}/`),
    ...artists.map((a) => `/artists/${a.id}/`),
    ...updates.map((u) => `/journal/${u.id}/`),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
