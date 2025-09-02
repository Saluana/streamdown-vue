export interface HardenOptions {
  defaultOrigin?: string;
  allowedLinkPrefixes: string[];
  allowedImagePrefixes: string[];
}

const resolveUrl = (url: string, base?: string): string => {
  if (!base) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
};

export const sanitizeUrl = (
  url: string,
  prefixes: string[],
  defaultOrigin?: string
): string | null => {
  if (!url) return null;
  let resolved = url.trim();
  resolved = resolveUrl(resolved, defaultOrigin);
  const lower = resolved.toLowerCase();
  if (lower.startsWith('javascript:')) return null;
  if (!prefixes.some((p) => lower.startsWith(p))) return null;
  return resolved;
};

export const hardenHref = (href: string, opts: HardenOptions): string | null => {
  return sanitizeUrl(href, opts.allowedLinkPrefixes, opts.defaultOrigin);
};

export const hardenSrc = (src: string, opts: HardenOptions): string | null => {
  return sanitizeUrl(src, opts.allowedImagePrefixes, opts.defaultOrigin);
};
