import { z } from "zod";
import sleep from "../lib/sleep";
import { CoreTool } from "@scoopika/types";

export function createAIButton(
  elm: string | HTMLElement,
  description?: string,
): CoreTool | undefined {
  if (typeof window === undefined) {
    console.error("AI buttons can only be used on the client-side");
    return;
  }

  const element = (
    typeof elm === "string" ? document.getElementById(elm) : elm
  ) as HTMLElement;

  const text = element.innerText;
  description =
    description ??
    element.getAttribute("data-scoopika-description") ??
    `Click this button when asked to click on ${text}`;

  const action: CoreTool = {
    name: `click_${text.toLowerCase().replace(" ", "_")}`,
    description,
    execute: async ({ delay }) => {
      if (!element) {
        throw new Error(`Button element not found!`);
      }
      if (typeof delay === "number") await sleep(delay);
      element.click();
    },
    parameters: z.object({
      delay: z
        .number()
        .describe("delay the click by ms. set to 0 to click immediatly")
        .optional(),
    }),
  };

  return action;
}
