import { describe, expect, it } from "vitest";
import { SaveWorkflowRequestSchema } from "@flowops/shared";
import { validateGraph } from "../engine/validate-graph.js";
import { DEMO_EXAMPLES } from "./examples.js";

describe("workflows d'exemple des sessions de démo", () => {
  it.each(DEMO_EXAMPLES.map((example) => [example.name, example] as const))(
    "%s : enregistrable et exécutable",
    (_name, example) => {
      expect(SaveWorkflowRequestSchema.safeParse(example).success).toBe(true);
      expect(validateGraph(example.graph).ok).toBe(true);
    },
  );
});
