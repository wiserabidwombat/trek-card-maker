/** A sentence telling the person what to do about a render failure, or '' when the message speaks for itself. */
export function renderErrorHint(message: string): string {
  if (/Failed to load image/i.test(message)) {
    return 'A frame, icon or artwork file could not be fetched. Check your connection and retry; if you run the app from source, make sure "npm run dev" is still running.';
  }
  if (/not in the catalog/i.test(message)) return 'Pick another frame for this card.';
  if (/font/i.test(message)) return 'Try the bundled fonts under Fonts… if a custom font was loaded.';
  return '';
}
