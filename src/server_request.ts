import { BoxHooks, Inputs } from "@scoopika/types";

export default function serverRequestBody(body: Record<string, any>) {
  const inputs = body.inputs;
  const hooks = body.hooks || [];

  if (!inputs || typeof inputs !== "object") {
    throw new Error("Invalid request body. inputs are required!");
  }

  if (typeof hooks !== "object" || !Array.isArray(hooks)) {
    throw new Error("Invalid request body. hooks have to be an array");
  }

  return { inputs, hooks } as {
    inputs: Inputs;
    hooks: Array<keyof BoxHooks>;
  };
}
