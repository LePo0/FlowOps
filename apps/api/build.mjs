// Build de production de l'API : un seul fichier dist/index.js, lancé par `node` sans tsx.
// Le code TypeScript du dépôt (API, @flowops/shared, client Prisma généré) est regroupé ;
// les paquets npm restent dans node_modules, installés à part dans l'image Docker.
import { build } from "esbuild";

// Les imports « nus » (pg, express…) restent externes, sauf le paquet partagé du dépôt :
// il n'existe qu'en TypeScript (exports: ./src/index.ts), Node ne pourrait pas le charger
const keepNpmPackagesExternal = {
  name: "external-npm-packages",
  setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, ({ path }) =>
      path === "@flowops/shared" || path.startsWith("@flowops/shared/")
        ? undefined
        : { path, external: true },
    );
  },
};

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  plugins: [keepNpmPackagesExternal],
  logLevel: "info",
});
