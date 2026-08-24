// OUTRANK stores plain text, not user-authored HTML. Keep control characters
// out of persisted fields while relying on React's escaping for rendered text.
export function plainText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
