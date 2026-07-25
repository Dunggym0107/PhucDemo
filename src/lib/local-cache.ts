// Cache nhỏ trong localStorage cho AppDataProvider — stale-while-revalidate.
// Scope theo user.id để 2 user trên cùng máy không thấy data của nhau.
// Bump CACHE_VERSION khi shape dữ liệu thay đổi → tự động bỏ qua entry cũ.

const CACHE_VERSION = 'v1';
const KEY_PREFIX = `appdata:${CACHE_VERSION}`;
const SIZE_LIMIT = 500 * 1024; // 500KB/entry — guard QuotaExceeded
const WARN_THRESHOLD = 400 * 1024;

interface CacheEntry<T> {
 data: T;
 savedAt: number;
}

function keyOf(scope: string, key: string): string {
 return `${KEY_PREFIX}:${scope}:${key}`;
}

export function getCached<T>(scope: string, key: string, ttlMs: number): T | null {
 if (typeof window === 'undefined') return null;
 try {
 const raw = window.localStorage.getItem(keyOf(scope, key));
 if (!raw) return null;
 const entry = JSON.parse(raw) as CacheEntry<T>;
 if (Date.now() - entry.savedAt > ttlMs) return null;
 return entry.data;
 } catch {
 return null;
 }
}

export function setCached<T>(scope: string, key: string, data: T): void {
 if (typeof window === 'undefined') return;
 try {
 const payload = JSON.stringify({ data, savedAt: Date.now() } satisfies CacheEntry<T>);
 if (payload.length > SIZE_LIMIT) return;
 if (payload.length > WARN_THRESHOLD && typeof console !== 'undefined') {
 console.warn(`[appdata] cache "${key}" gần chạm trần (${(payload.length / 1024).toFixed(0)}KB).`);
 }
 window.localStorage.setItem(keyOf(scope, key), payload);
 } catch {
 // QuotaExceeded / SecurityError → silent skip, in-memory state vẫn còn
 }
}

// Gọi khi logout để không leak data sang user khác trên cùng máy.
export function flushCache(): void {
 if (typeof window === 'undefined') return;
 try {
 const keys: string[] = [];
 for (let i = 0; i < window.localStorage.length; i++) {
 const k = window.localStorage.key(i);
 if (k && k.startsWith('appdata:')) keys.push(k);
 }
 keys.forEach((k) => window.localStorage.removeItem(k));
 } catch {
 // ignore
 }
}
