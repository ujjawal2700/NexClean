/** Generate a random 6-digit numeric OTP code. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
