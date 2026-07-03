const roomIdLettersPattern = /^[a-z]{9}$/;

export function normalizeRoomIdInput(value: string) {
  const letters = value.trim().toLowerCase().replace(/[\s-]+/g, "");

  if (!roomIdLettersPattern.test(letters)) {
    return "";
  }

  return `${letters.slice(0, 3)}-${letters.slice(3, 6)}-${letters.slice(6)}`;
}
