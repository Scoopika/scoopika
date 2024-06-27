import { createSchema } from "../../src";
import { z } from "zod";
import validate from "../../src/lib/validate";

const schema = createSchema(
  z.object({
    name: z.string(),
    numbers: z.array(z.number()),
  }),
);

const validated = validate(schema, {
  name: "kais",
  numbers: [0, 1, 2],
});

console.log(validated);
