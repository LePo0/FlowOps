import ipaddr from "ipaddr.js";

export type HitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  // Compte une requête pour `key` si la limite le permet
  hit(key: string, limit: number): HitResult;
}

// Au-delà de ce nombre de clés, les fenêtres expirées sont purgées : la mémoire reste bornée
// même si chaque requête vient d'une adresse différente
const SWEEP_THRESHOLD = 10_000;

/**
 * Fenêtre glissante en mémoire : au plus `limit` requêtes par `windowMs` et par clé.
 * Le compteur est propre à l'instance et repart de zéro au redémarrage : limite approximative,
 * acceptée tant que Cloud Run tourne sur peu d'instances (scénario Q9).
 */
export function createRateLimiter(windowMs: number, now = () => Date.now()): RateLimiter {
  const hits = new Map<string, number[]>();

  const sweep = (time: number) => {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= time - windowMs)) hits.delete(key);
    }
  };

  return {
    hit(key, limit) {
      const time = now();
      if (hits.size > SWEEP_THRESHOLD) sweep(time);
      const recent = (hits.get(key) ?? []).filter((t) => t > time - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? time;
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - time) / 1000)),
        };
      }
      recent.push(time);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}

export interface ConcurrencyLimiter {
  // Fonction de libération si une place est libre, null sinon
  acquire(key: string, max: number): (() => void) | null;
}

export function createConcurrencyLimiter(): ConcurrencyLimiter {
  const running = new Map<string, number>();
  return {
    acquire(key, max) {
      const count = running.get(key) ?? 0;
      if (count >= max) return null;
      running.set(key, count + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (running.get(key) ?? 1) - 1;
        if (left > 0) running.set(key, left);
        else running.delete(key);
      };
    },
  };
}

/**
 * Clé de limite pour une adresse IP. Une connexion IPv6 dispose en général d'un /64 entier :
 * limiter par adresse exacte se contournerait en changeant les derniers groupes.
 */
export function ipKey(ip: string | undefined): string {
  if (!ip || !ipaddr.isValid(ip)) return "inconnue";
  const address = ipaddr.process(ip);
  if (address.kind() === "ipv4") return address.toString();
  const parts = (address as ipaddr.IPv6).parts.slice(0, 4);
  return `${parts.map((part) => part.toString(16)).join(":")}::/64`;
}
