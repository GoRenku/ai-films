// Deploys the verified static build in dist/ to the latent-matinee Cloudflare Pages project.
// Credentials come from the git-ignored .env (CLOUDFLARE_TOKEN, CLOUDFLARE_ACCOUNT_ID) or the environment.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_TOKEN;
if (!token || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error("Missing CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID (set them in .env).");
  process.exit(1);
}
if (!existsSync("dist/index.html")) {
  console.error("dist/ is missing; run pnpm build first.");
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "wrangler", "pages", "deploy", "dist", "--project-name", "latent-matinee", "--branch", "main", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, CLOUDFLARE_API_TOKEN: token } },
);
process.exit(result.status ?? 1);
