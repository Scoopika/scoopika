import { LocalAudio, RemoteAudio } from "@scoopika/types";
import { Scoopika, readAudio } from "../src";
import { test, expect } from "vitest";

const scoopika = new Scoopika();

test("Read local audio file", async () => {
  const audio: LocalAudio = {
    type: "local",
    path: "./tests/sample.flac",
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
