import { Base64Audio, RemoteAudio } from "@scoopika/types";
import { Scoopika, readAudio } from "../src";
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";

const scoopika = new Scoopika();

test("Read local audio file", async () => {
  const audio: Base64Audio = {
    type: "base64",
    value: readFileSync("/home/kais/Downloads/concat.mp3").toString("base64"),
  };

  const res = await readAudio(scoopika, audio);

  console.log(res);
  expect(typeof res.text).toBe("string");
  expect(typeof res.url).toBe("string");
});

test("Read remote audio file", async () => {
  const audio: RemoteAudio = {
    type: "remote",
    path: "https://replicate.delivery/pbxt/OByN1LXxsXY1MpvKjiEsO8wBJ7rBgXZgjfiID0yVr21ZXKcJA/output.wav",
  };

  const res = await readAudio(scoopika, audio);

  expect(typeof res.text).toBe("string");
  expect(typeof res.url).toBe("string");
  console.log(res);
});
