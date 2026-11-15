export function canonicalRoomCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
}
