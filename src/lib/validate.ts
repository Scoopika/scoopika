import { ToolSchema } from "@scoopika/types";
import Ajv from "ajv";
import new_error from "./error";

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
