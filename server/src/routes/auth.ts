import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router: ReturnType<typeof Router> = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TOKEN_EXPIRY = '24h';

/**
 * POST /api/auth/login
 * Validates username/password against env vars, returns JWT
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  const validUsername = process.env.APP_USERNAME || 'admin';
  const validPassword = process.env.APP_PASSWORD || 'changeme';

  if (username === validUsername && password === validPassword) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    console.log(`[AUTH] ✓ Login successful for user: ${username}`);
    res.json({ token, username, expiresIn: TOKEN_EXPIRY });
  } else {
    console.warn(`[AUTH] ✗ Login failed for user: ${username}`);
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

/**
 * GET /api/auth/verify
 * Validates the JWT token is still valid
 */
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ valid: false });
    return;
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    res.json({ valid: true, username: decoded.username });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export { router as authRouter };

