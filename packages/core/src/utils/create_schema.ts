import { JSONSchema } from "openai/lib/jsonschema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export function createSchema<ZOD extends z.ZodTypeAny = any>(zod_s: ZOD) {
  const json = zodToJsonSchema(zod_s, "schema").definitions?.schema;

  if (!json) {
    throw new Error("Can't read json schema");
  }

  return json as JSONSchema;
}
