import { readdir, readFile, access } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
const root = resolve("dist");
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
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Validated ${pages.length} pages: local links, assets, titles and image descriptions.`,
);
