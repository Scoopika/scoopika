import openai from "./openai";
import google from "./google";

const hosts = {
  openai,
  fireworks: openai,
  together: openai,
  google,
};

export default hosts;
