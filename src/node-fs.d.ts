// Minimal typing for the one build-time fs call in src/lib/catalog.ts (the project ships no @types/node).
declare module 'node:fs' {
  export function readFileSync(path: URL | string): Uint8Array;
}
