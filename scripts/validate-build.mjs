import { readdir, readFile, access } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
const root = resolve("dist");
const site = "https://latentmatinee.com";
const errors = [];
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    ),
  );
  return nested.flat();
}
const files = await walk(root);
const pages = files.filter((f) => f.endsWith(".html"));
for (const file of pages) {
  const html = await readFile(file, "utf8");
  if (!/<title>[^<]+<\/title>/.test(html))
    errors.push(`${file}: missing page title`);
  if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1)
    errors.push(`${file}: expected one h1`);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    const link = match[1].replaceAll("&amp;", "&");
    if (/^(?:https?:|mailto:|data:|tel:|\/\/)/.test(link)) continue;
    const path = decodeURIComponent(link.split("?")[0]);
    let target = path.startsWith("/")
      ? resolve(root, "." + path)
      : resolve(dirname(file), path);
    if (!target.startsWith(root + "/") && target !== root) {
      errors.push(`${file}: path escapes build: ${link}`);
      continue;
    }
    if (path.endsWith("/")) target = join(target, "index.html");
    try {
      await access(target);
    } catch {
      errors.push(`${file}: broken local link ${link}`);
    }
  }
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="[^"]*"/.test(img[0]))
      errors.push(`${file}: image missing alt`);
  }
  if (/<script\b[^>]*src="https?:/i.test(html))
    errors.push(`${file}: unexpected remote script`);
}
const home = await readFile(join(root, "index.html"), "utf8");
const slides = (home.match(/<article class="slide[\s"]/g) || []).length;
if (slides < 3)
  errors.push(`index.html: homepage hero rendered ${slides} slides (expected at least 3)`);

const decode = (text) => text.replaceAll("&amp;", "&");
const canonicalUrl = (file) =>
  `${site}/${file.slice(root.length + 1).replace(/index\.html$/, "")}`;
const indexedPages = pages.filter((f) => f !== join(root, "404.html"));
const builtUrls = new Set(indexedPages.map(canonicalUrl));

async function readBuilt(name) {
  try {
    return await readFile(join(root, name), "utf8");
  } catch {
    errors.push(`${name}: missing from the build`);
    return "";
  }
}

async function checkSitemap() {
  const xml = await readBuilt("sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  const listed = new Set(locs);
  if (listed.size !== locs.length) errors.push("sitemap.xml: duplicate URLs");
  for (const url of builtUrls)
    if (!listed.has(url)) errors.push(`sitemap.xml: missing ${url}`);
  for (const url of listed)
    if (!builtUrls.has(url)) errors.push(`sitemap.xml: lists ${url}, which is not a built page`);
}

async function checkRobots() {
  const lines = (await readBuilt("robots.txt")).split("\n").filter((l) => /^sitemap:/i.test(l));
  if (lines.length !== 1 || lines[0] !== `Sitemap: ${site}/sitemap.xml`)
    errors.push(`robots.txt: expected one line "Sitemap: ${site}/sitemap.xml"`);
}

async function checkFeed() {
  const xml = await readBuilt("journal/rss.xml");
  const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => decode(m[1]));
  const entries = indexedPages.filter((f) => /\/journal\/[^/]+\/index\.html$/.test(f));
  if (links.length !== entries.length)
    errors.push(`journal/rss.xml: ${links.length} items for ${entries.length} journal entries`);
  for (const link of links)
    if (!builtUrls.has(link)) errors.push(`journal/rss.xml: item link ${link} is not a built page`);
}

async function checkShareImages() {
  for (const file of pages) {
    const html = await readFile(file, "utf8");
    for (const m of html.matchAll(/<meta property="og:image" content="([^"]+)"/g)) {
      const url = decode(m[1]);
      if (!url.startsWith(`${site}/`)) {
        errors.push(`${file}: share image ${url} is not on ${site}`);
        continue;
      }
      try {
        await access(join(root, decodeURIComponent(url.slice(site.length))));
      } catch {
        errors.push(`${file}: share image ${url} is not in the build`);
      }
    }
  }
}

await checkSitemap();
await checkRobots();
await checkFeed();
await checkShareImages();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Validated ${pages.length} pages: local links, assets, titles, image descriptions and ${slides} hero slides; sitemap, robots.txt, journal feed and share images.`,
);
