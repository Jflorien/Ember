import { randomBytes } from "crypto";

/** No 0/O/1/I/L — invite codes get read aloud and typed from memory. */
const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Lives here rather than in src/app/dm/actions.ts because that file is
 * "use server", where every export has to be an async server action — a
 * sync helper can't be shared out of it.
 */
export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}
