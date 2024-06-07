import { Base64Audio, RemoteAudio } from "@scoopika/types";
import { Scoopika, readAudio } from "../src";
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";

const scoopika = new Scoopika();

test("Read local audio file", async () => {
  const audio: Base64Audio = {
    type: "base64",
    value: readFileSync("./tests/sample.flac").toString("base64"),
  };

  const text = await readAudio(scoopika, {}, audio);

  expect(typeof text).toBe("string");
});

test("Read remote audio file", async () => {
  const audio: RemoteAudio = {
    type: "remote",
    path: "https://replicate.delivery/pbxt/OByN1LXxsXY1MpvKjiEsO8wBJ7rBgXZgjfiID0yVr21ZXKcJA/output.wav",
  };

  const text = await readAudio(scoopika, {}, audio);

  console.log(text);
});
