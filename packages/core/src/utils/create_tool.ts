import { ToolFunction } from "@scoopika/types";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CoreTool } from "@scoopika/types";
import { JSONSchema } from "openai/lib/jsonschema";

export function createTool<PARAMETERS extends z.ZodTypeAny, RESULT = any>(
  tool: CoreTool<PARAMETERS, RESULT>,
): {
  execute: (args: PARAMETERS) => RESULT | PromiseLike<RESULT> | void;
  schema: ToolFunction;
} {
  const json = zodToJsonSchema(tool.parameters, "schema").definitions?.schema;
  if (!json) throw new Error("Can't read tool parameters");

  return {
    execute: tool.execute,
    schema: {
      name: tool.name,
      description: tool.description || "",
      parameters: json as JSONSchema,
    },
  };
}
