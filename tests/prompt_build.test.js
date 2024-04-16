import { expect, test } from "vitest";
import buildPrompt from "../dist/lib/build_prompt";

const prompt = {
  id: "1",
  index: 0,
  variable_name: "cat_prompt",
  content: "You are a cat called <<name>>, and color <<color>>",
  inputs: [
    {
      id: "name",
      description: "the cat name",
      required: true,
    },
    {
      id: "color",
      description: "the cat color",
      required: true,
      default: "white",
    },
  ],
};

test("Build prompt with one input", () => {
  const built_prompt = buildPrompt(prompt, { name: "meow" });

  expect(built_prompt.content).toBe(
    "You are a cat called meow, and color white",
  );
});

test("Build prompt with two inputs", () => {
  const built_prompt = buildPrompt(prompt, { name: "kitty", color: "black" });

  expect(built_prompt.content).toBe(
    "You are a cat called kitty, and color black",
  );
});

test("Build prompt with missing inputs", () => {
  const built_prompt = buildPrompt(prompt, {});

  expect(built_prompt.missing.length).toBe(1);
});
