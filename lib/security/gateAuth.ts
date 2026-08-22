import { constantTimeCompare, hashToken } from '@/lib/crypto/tokens';

const SESSION_SECRET = process.env.GATE_SESSION_SECRET || 'weddingpass_gate_secret_key_2026';

export interface GateSessionPayload {
  eventId: string;
  stationName: string;
  operatorName: string;
  gateSection: 'men' | 'women' | 'general';
  expiresAt: number;
}

/**
 * Creates a signed HMAC Gate Session Token
 */
export async function createGateSessionToken(payload: GateSessionPayload): Promise<string> {
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data).toString('base64url');
  const signature = await hashToken(`${base64Data}.${SESSION_SECRET}`);
  return `${base64Data}.${signature}`;
}

/**
 * Verifies a Gate Session Token and returns payload if valid
 */
export async function verifyGateSessionToken(token: string): Promise<GateSessionPayload | null> {
  try {
    if (!token || !token.includes('.')) return null;
    const [base64Data, signature] = token.split('.');
    const expectedSig = await hashToken(`${base64Data}.${SESSION_SECRET}`);
    
    if (!constantTimeCompare(signature, expectedSig)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const payload: GateSessionPayload = JSON.parse(jsonStr);

    if (Date.now() > payload.expiresAt) {
      return null; // Expired session
    }

    return payload;
  } catch (err) {
    return null;
  }
}
