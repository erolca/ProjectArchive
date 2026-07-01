import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { AuthTokenPayload, AuthenticatedUser } from "../modules/auth/auth.types";

const DEFAULT_SESSION_EXPIRES_IN = "8h";

export function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured and at least 32 characters long.");
  }

  return secret;
}

export function getSessionExpiresIn(): string {
  return process.env.SESSION_EXPIRES_IN || DEFAULT_SESSION_EXPIRES_IN;
}

export function createAuthToken(user: AuthenticatedUser): string {
  const payload: AuthTokenPayload = {
    sub: String(user.id),
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
  const options: SignOptions = {
    expiresIn: getSessionExpiresIn() as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (!isAuthTokenPayload(decoded)) {
    throw new Error("Invalid authentication token.");
  }

  return decoded;
}

export function extractBearerToken(authorizationHeader?: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function isAuthTokenPayload(value: string | jwt.JwtPayload): value is AuthTokenPayload {
  if (typeof value === "string") {
    return false;
  }

  return (
    typeof value.sub === "string" &&
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.role === "string"
  );
}
