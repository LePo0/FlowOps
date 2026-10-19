import type { ApiErrorResponse } from "@flowops/shared";
import type { z } from "zod";

// Réponse 400 commune aux routes : un message par problème, préfixé par son chemin
export function invalidBody(error: z.ZodError): ApiErrorResponse {
  return {
    errors: error.issues.map((issue) => ({
      code: "INVALID_BODY",
      message: `${issue.path.map(String).join(".") || "corps"} : ${issue.message}`,
    })),
  };
}

export function notFound(message: string): ApiErrorResponse {
  return { errors: [{ code: "NOT_FOUND", message }] };
}
