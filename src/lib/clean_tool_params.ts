import * as types from "@scoopika/types";

// We pass required just to handle the parent required field
function cleanObject(
  source: Record<string, types.Parameter>,
  required: string[],
) {
  const res: Record<string, types.Parameter> = {};
  const required_props: string[] = [...required];

  for (const key of Object.keys(source)) {
    const param = source[key];

    if (param.type === "object") {
      const { properties, required } = cleanObject(
        param.properties,
        param.required || [],
      );
      res[key] = { type: "object", properties };
      if (required.length > 0) {
        res[key]["required"] = required;
      }
      continue;
    }

    if (param.type === "array") {
      res[key] = {
        description: param.description,
        type: param.type,
        items: param.items,
      };
      continue;
    }

    const clean: types.Parameter = {
      description: param.description,
      type: param.type,
    };

    if (param.enum) {
      clean.enum = param.enum;
    }

    res[key] = clean;

    if (param.required && required_props.indexOf(key) === -1) {
      required_props.push(key);
    }
  }

  return { properties: res, required: required_props };
}

export default function cleanToolParams(
  params: types.ToolParameters,
): types.ToolParameters {
  const { properties, required } = cleanObject(
    params.properties,
    params.required || [],
  );
  return { type: "object", properties, required };
}
