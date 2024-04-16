interface PromptInput extends ParameterBase {
  id: string;
}

interface BasePrompt {
  id: string;
  index: number;
  variable_name: string;
  description?: string;
  llm_client: string;
  model: string;
  type: "text" | "json";
  options: Record<string, any>;
  tool_choice?: string;
  conversational?: boolean;
  inputs: PromptInput[];
  content: string;
}

type ImageSize =
  | "265x265"
  | "512x512"
  | "1024x1024"
  | "1792x1024"
  | "1792x1024"
  | null
  | undefined;

interface ImagePrompt extends BasePrompt {
  type: "image";
  n: number;
  size: ImageSize;
}

type Prompt = BasePrompt | ImagePrompt;

interface BuiltPrompt {
  missing: PromptInput[];
  content: string;
}
