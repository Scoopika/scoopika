import { z } from "zod";
import { createAction } from "./create_action";
import { CoreTool } from "@scoopika/types";

export function createAIInput(
  elm: string | HTMLInputElement,
  description?: string,
): CoreTool | undefined {
  if (typeof window === undefined) {
    console.error("AI buttons can only be used on the client-side");
    return;
  }

  const element = (
    typeof elm === "string" ? document.getElementById(elm) : elm
  ) as HTMLInputElement;

  const text = element.id || element.placeholder;
  description =
    description ??
    element.getAttribute("data-scoopika-description") ??
    `Enter value in this input element. it's about '${text}'`;

  const action: CoreTool = {
    name: `enter_value_in_${text.toLowerCase().replace(" ", "_")}`,
    description,
    execute: async ({ value }) => {
      if (!element) {
        throw new Error(`Button element not found!`);
      }
      element.value = value;
    },
    parameters: z.object({
      value: z.string().describe("The value to enter into the input"),
    }),
  };

  return action;
}
