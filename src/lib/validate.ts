import Ajv from "ajv";
import { JSONSchema } from "openai/lib/jsonschema";

export default function validate(
  schema: JSONSchema,
  data: unknown,
):
  | {
      success: true;
    }
  | {
      success: false;
      errors: string[];
    } {
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      const prop = schema.properties[key] as any;
      delete prop["required"];
    }
  }

  const ajv = new Ajv();
  const validation = ajv.validate(schema, data);

  ajv.compile(schema);
  if (!validation) {
    const errors = ajv.errors || ["Unexpected validation error!"];
    const response: { success: false; errors: any[] } = {
      success: false,
      errors: [],
    };

    for (const err of errors) {
      if (!err) continue;
      if (typeof err === "string") {
        response.errors.push(err);
      }

      const path = (err as any)?.instancePath || "unknown";
      const message = (err as any)?.message || "";
      response.errors.push(`validation error: ${path} ${message}`);
    }

    console.error(response.errors);
    return response;
  }

  return { success: true };
}
