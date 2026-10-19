import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import type { Transport } from "./guarded-fetch.js";

// Résolution « truquée » qui renvoie toujours l'adresse déjà vérifiée par la garde
function pinnedLookup(address: string): LookupFunction {
  const family = isIP(address);
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

/**
 * Transport réel du nœud HTTP : undici, connecté à l'adresse vérifiée par la garde.
 * Le nom reste utilisé pour l'en-tête Host et pour TLS (SNI, vérification du certificat) :
 * seule la résolution DNS est court-circuitée. Les redirections ne sont pas suivies ici.
 */
export const pinnedTransport: Transport = async (url, init, address) => {
  // Un agent par requête : l'adresse épinglée ne peut pas servir à une autre requête
  const dispatcher = new Agent({ connect: { lookup: pinnedLookup(address) } });
  try {
    const response = await undiciFetch(url, {
      ...(init as Parameters<typeof undiciFetch>[1]),
      redirect: "manual",
      dispatcher,
    });
    // Fermeture douce : l'agent attend la fin de la lecture du corps avant de fermer
    void dispatcher.close();
    return response as unknown as Response;
  } catch (error) {
    void dispatcher.destroy();
    throw error;
  }
};
