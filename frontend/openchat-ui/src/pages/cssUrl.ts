// A host-given image URL as a CSS url("…") value (cover images). The URL is used as it is, so an already
// percent-encoded one stays valid; only what would end the string early or break it is escaped.

export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\]/g, '\\$&').replace(/\r\n|[\n\r\f]/g, '\\a ')}")`;
}
