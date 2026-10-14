// Clipboard write that reports the outcome: false when the API is missing (insecure context), the document has no focus,
// or permission is denied. Callers show "Copied" only on true.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
