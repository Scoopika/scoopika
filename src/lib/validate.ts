import { Parameter, ToolSchema } from "@scoopika/types";
import Ajv from "ajv";
import new_error from "./error";

export function validateObject(
  schema: Record<string, Parameter>,
  required: string[],
  data: any,
):
  | { success: false; error: string }
  | { success: true; data: Record<string, any> } {
  if (typeof data !== "object") {
    return {
      success: false,
      error: `Invalid data type received from LLM: ${typeof data}`,
    };
  }

  let validated_data: Record<string, any> = JSON.parse(JSON.stringify(data));

  for (const key of Object.keys(schema)) {
    const param = schema[key];

    if (param.type === "object") {
      const nested = validateObject(
        param.properties,
        param.required || [],
        validated_data[key] || {},
      );
      if (!nested.success) {
        return nested;
      }
      validated_data = { ...validated_data, [key]: nested.data };
      continue;
    }

    if (
      param.default !== undefined &&
      (validated_data[key] === undefined || validated_data[key] === null)
    ) {
      validated_data[key] = param.default;
    }

    const is_required = param.required || required.indexOf(key) !== -1;

    if (
      is_required &&
      (validated_data[key] === undefined || validated_data[key] === null)
    ) {
      return {
        success: false,
        error: `Missing required data: ${key}: ${param.description || "Unknown decsription"}`,
      };
    }

    if (!param.enum || param.enum.length < 1) {
      continue;
    }

    if (param.enum.indexOf(data[key]) === -1) {
      const joined = param.enum.join(", ");
      return {
        success: false,
        error: `Invalid data for ${key}: ${param.description}. expected one of (${joined}), but instead got ${data[key]}`,
      };
    }
  }

  return { success: true, data: validated_data };
}

export default function validate(
  schema: ToolSchema["tool"]["function"]["parameters"],
  data: unknown,
): void {
  const ajv = new Ajv();
  const validation = ajv.validate(schema, data);

  if (!validation) {
    const errors =
      typeof ajv.errors === "string" ? ajv.errors : JSON.stringify(ajv.errors);
    throw new Error(new_error("invalid_data", errors, "ajv validation"));
  }
}
