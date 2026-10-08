import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://latentmatinee.com",
  output: "static",
  trailingSlash: "always",
  server: { port: 4327 },
});
