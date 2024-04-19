function sleep(ms?: number) {
  if (typeof ms !== "number") {
    ms = 0;
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default sleep;
