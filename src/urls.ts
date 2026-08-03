export const SOURCE_URL_PROTOCOLS = ["https:", "http:"] as const;

export function isAllowedSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return SOURCE_URL_PROTOCOLS.includes(
      url.protocol as (typeof SOURCE_URL_PROTOCOLS)[number],
    );
  } catch {
    return false;
  }
}
