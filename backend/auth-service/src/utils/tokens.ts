// Single responsibility: JWT sign/verify and token hashing
import type { JwtAccessPayload, JwtRefreshPayload } from '@nerdco/domain-types';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

const getPrivate = () => requiredEnv('JWT_PRIVATE_KEY').replace(/\\n/g, '\n');
const getPublic  = () => requiredEnv('JWT_PUBLIC_KEY').replace(/\\n/g, '\n');

const signAccess  = (payload: JwtAccessPayload) => jwt.sign(payload, getPrivate(), { algorithm: 'RS256', expiresIn: process.env.JWT_ACCESS_EXPIRES  || '15m' });
const signRefresh = (payload: JwtRefreshPayload) => jwt.sign(payload, getPrivate(), { algorithm: 'RS256', expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
const verify      = (token: string) => jwt.verify(token, getPublic(), { algorithms: ['RS256'] });
const hash        = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { signAccess, signRefresh, verify, hash };
