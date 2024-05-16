export default function autoHeal(func: Function) {
  try {
    func();
  } catch (err: any) {
    const message: string = err.message || "Unexpected error";
    throw new Error(message);
  }
}
