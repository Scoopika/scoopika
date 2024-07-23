export function readError(err: any): string {
  if (typeof err === "string") {
    return err;
  }

  if (typeof err?.msg === "string") {
    return err?.msg;
  }

  console.error("Unknown error:", err);
  return JSON.stringify(err);
}
