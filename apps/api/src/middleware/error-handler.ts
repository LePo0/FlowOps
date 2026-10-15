import type { ErrorRequestHandler } from "express";

// Erreurs levées par express.json() (body-parser) : elles portent un type stable
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err && typeof err.type === "string") {
    return err.type;
  }
  return undefined;
}

// Middleware final : toujours une réponse JSON, jamais de stack trace ni de détail interne
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const type = bodyParserErrorType(err);
  if (type === "entity.parse.failed") {
    res.status(400).json({ errors: [{ code: "INVALID_JSON", message: "JSON mal formé" }] });
    return;
  }
  if (type === "entity.too.large") {
    res
      .status(413)
      .json({ errors: [{ code: "PAYLOAD_TOO_LARGE", message: "Corps trop volumineux" }] });
    return;
  }

  console.error(err);
  res.status(500).json({ errors: [{ code: "INTERNAL_ERROR", message: "Erreur interne" }] });
};
