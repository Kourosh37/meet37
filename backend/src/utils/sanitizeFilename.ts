export function sanitizeFilename(filename: string): string {
  const sanitized = Array.from(filename)
    .map((char) => {
      if (/^[a-z0-9_.-]$/i.test(char)) {
        return char;
      }
      return '_';
    })
    .join('');

  if (sanitized.replace(/_/g, '').length === 0) {
    return 'file.bin';
  }

  return sanitized;
}
