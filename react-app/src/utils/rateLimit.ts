const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
};

export const getRateLimitKey = (action: string, identifier: string): string => {
  return `${action}:${identifier}`;
};
