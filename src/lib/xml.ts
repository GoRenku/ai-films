const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Escapes text for XML element content and attribute values. */
export const escapeXml = (text: string) => text.replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
