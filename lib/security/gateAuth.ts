import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { constantTimeCompare } from '../crypto/tokens.ts';

export type GateRole = 'operator' | 'supervisor';

export interface GateSessionPayload {
  eventId: string;
  stationId: string;
  stationName: string;
  operatorId: string;
  operatorName: string;
  role: GateRole;
  gateSection: 'men' | 'women' | 'general';
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.GATE_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: GATE_SESSION_SECRET environment variable is missing in production!');
    }
    return 'dev_gate_hmac_secret_key_weddingpass_2026_hardened';
  }
  return secret;
}

/**
 * Creates a genuine HMAC-SHA256 signed Gate Session Token
 */
export function createGateSessionToken(payload: GateSessionPayload): string {
  const secret = getSessionSecret();
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${hmac}`;
}

/**
 * Verifies a Gate Session Token using constant-time HMAC validation
 */
export function verifyGateSessionToken(token: string): GateSessionPayload | null {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return null;
    }

    const secret = getSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [base64Data, providedHmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');

    if (!constantTimeCompare(providedHmac, expectedHmac)) {
      return null; // Signature mismatch
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const payload: GateSessionPayload = JSON.parse(jsonStr);

    if (!payload.eventId || !payload.expiresAt) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null; // Expired session
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and strictly verifies the Gate Session from NextRequest (Cookie or Header)
 */
export async function getVerifiedGateSession(req: NextRequest): Promise<GateSessionPayload | null> {
  // 1. Try HttpOnly Cookie
  const cookieToken = req.cookies.get('gate_session')?.value;
  if (cookieToken) {
    const verified = verifyGateSessionToken(cookieToken);
    if (verified) return verified;
  }

  // 2. Try Authorization Bearer Header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    const verified = verifyGateSessionToken(bearerToken);
    if (verified) return verified;
  }

  // 3. Try custom header
  const customHeaderToken = req.headers.get('x-gate-session');
  if (customHeaderToken) {
    const verified = verifyGateSessionToken(customHeaderToken.trim());
    if (verified) return verified;
  }

  return null;
}
