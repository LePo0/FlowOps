import ipaddr from "ipaddr.js";

// Politique réseau du nœud HTTP : quelles adresses le serveur a le droit de contacter.
// Règles et scénarios : docs/security/http-node.md.

export type Decision = "allow" | "deny";

export interface NetworkPolicy {
  // hostname : nom demandé dans l'URL (règles par domaine) ; address : IP effectivement contactée
  decide(hostname: string, address: string): Decision;
}

export interface NetworkPolicyConfig {
  // Listes séparées par des virgules : réseaux (10.20.0.0/16, ou une adresse seule), domaines
  // (api.interne.fr, ou *.interne.fr pour ses sous-domaines). Lues dans HTTP_ALLOWED_TARGETS et
  // HTTP_DENIED_TARGETS.
  allowed?: string;
  denied?: string;
}

type Address = ipaddr.IPv4 | ipaddr.IPv6;
type Rule =
  | { kind: "network"; network: [Address, number] }
  | { kind: "domain"; name: string; subdomains: boolean };

// Interdits quelle que soit la configuration : la machine elle-même, le lien local (dont le
// serveur de métadonnées du cloud, 169.254.169.254) et l'adresse non spécifiée
const ALWAYS_DENIED = new Set(["loopback", "linkLocal", "unspecified"]);

// Nom de domaine : étiquettes de lettres, chiffres et tirets séparées par des points
const DOMAIN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

function parseRule(entry: string): Rule {
  const value = entry.toLowerCase();
  if (value.includes("/")) {
    try {
      return { kind: "network", network: ipaddr.parseCIDR(value) };
    } catch {
      throw new Error(`Cible invalide : « ${entry} » (réseau attendu, ex. 10.20.0.0/16)`);
    }
  }
  if (ipaddr.isValid(value)) {
    const address = ipaddr.parse(value);
    return { kind: "network", network: [address, address.kind() === "ipv4" ? 32 : 128] };
  }
  const subdomains = value.startsWith("*.");
  const name = subdomains ? value.slice(2) : value;
  // Une suite de chiffres et de points est une adresse IPv4 mal écrite, pas un domaine
  if (!DOMAIN.test(name) || /^[\d.]+$/.test(name)) {
    throw new Error(`Cible invalide : « ${entry} » (réseau, adresse ou domaine attendu)`);
  }
  return { kind: "domain", name, subdomains };
}

// Lève une erreur qui cite l'entrée fautive : une faute de saisie ne doit pas ouvrir le réseau
function parseRules(list: string | undefined): Rule[] {
  return (list ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map(parseRule);
}

function matches(rule: Rule, hostname: string, address: Address): boolean {
  if (rule.kind === "domain") {
    return rule.subdomains ? hostname.endsWith(`.${rule.name}`) : hostname === rule.name;
  }
  const [network] = rule.network;
  return address.kind() === network.kind() && address.match(rule.network);
}

export function createNetworkPolicy(config: NetworkPolicyConfig = {}): NetworkPolicy {
  const allowed = parseRules(config.allowed);
  const denied = parseRules(config.denied);

  return {
    decide: (rawHostname, rawAddress) => {
      if (!ipaddr.isValid(rawAddress)) return "deny";
      // process() ramène une adresse IPv4 écrite en IPv6 (::ffff:127.0.0.1) à sa forme IPv4
      const address = ipaddr.process(rawAddress);
      const hostname = rawHostname.toLowerCase();
      const range = address.range();

      if (ALWAYS_DENIED.has(range)) return "deny";
      if (denied.some((rule) => matches(rule, hostname, address))) return "deny";
      if (allowed.some((rule) => matches(rule, hostname, address))) return "allow";
      // « unicast » = adresse publique ; privé, partagé, réservé, multicast… sont refusés
      return range === "unicast" ? "allow" : "deny";
    },
  };
}
