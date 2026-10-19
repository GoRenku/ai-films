import type { APIRoute } from 'astro';
import { catalog, toTime } from '../../lib/catalog';
import { escapeXml } from '../../lib/xml';

const feedDate = (date: string) => new Date(toTime(date)).toUTCString();

export const GET: APIRoute = async ({ site }) => {
  const { updates } = await catalog();
  const url = (path: string) => escapeXml(new URL(path, site).href);
  const items = updates.map((u) =>
    [
      '    <item>',
      `      <title>${escapeXml(u.data.title)}</title>`,
      `      <link>${url(`/journal/${u.id}/`)}</link>`,
      `      <guid isPermaLink="true">${url(`/journal/${u.id}/`)}</guid>`,
      `      <pubDate>${feedDate(u.data.date)}</pubDate>`,
      `      <description>${escapeXml(u.data.description)}</description>`,
      '    </item>',
    ].join('\n'),
  );
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Latent Matinee Journal</title>',
    `    <link>${url('/journal/')}</link>`,
    '    <description>Field notes: discoveries, release milestones and production craft in AI cinema.</description>',
    '    <language>en</language>',
    `    <atom:link href="${url('/journal/rss.xml')}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${feedDate(updates[0].data.date)}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
