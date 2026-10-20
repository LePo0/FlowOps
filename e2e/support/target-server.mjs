// Service cible des tests de bout en bout : ce que le nœud HTTP appelle, sans dépendre d'Internet
import { createServer } from "node:http";

const host = process.env.TARGET_HOST;
const port = Number(process.env.TARGET_PORT);

const PRODUCTS = {
  products: [
    { id: 1, title: "Clavier", price: 49 },
    { id: 2, title: "Souris", price: 19 },
  ],
};

const server = createServer((req, res) => {
  const send = (status, body) =>
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));

  if (req.url === "/health") return send(200, { status: "ok" });
  if (req.url === "/produits") return send(200, PRODUCTS);
  return send(404, { message: "Introuvable" });
});

server.listen(port, host, () => console.log(`Service cible sur http://${host}:${port}`));
