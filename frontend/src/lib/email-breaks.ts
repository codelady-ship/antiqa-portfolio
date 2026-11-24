/**
 * An email split where a line may break (#68): after "@" and before each ".".
 * Joining the parts gives the address back unchanged.
 */
export function emailBreaks(email: string): string[] {
  return email.split(/(?<=@)|(?=\.)/).filter(Boolean);
}
