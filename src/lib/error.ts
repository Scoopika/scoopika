function new_error(code: string, msg: string, stage: string): string {
  return `${code}:::${msg}:::${stage}`;
}

export default new_error;
