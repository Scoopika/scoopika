interface ParameterBase {
  description?: string;
  enum?: Array<any>;
  type: "string" | "boolean" | "number";
  default?: any;
  important?: boolean;
  required?: boolean;
}

interface ArrayParameter extends ParameterBase {
  type: "array";
  items: { type: string };
}

interface ObjectParameter extends ParameterBase {
  type: "object";
  properties: Record<string, ParameterBase | ArrayParameter | ObjectParameter>;
  required?: Array<string>;
}

type Parameter = ParameterBase | ArrayParameter | ObjectParameter;
