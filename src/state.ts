import new_error from "./lib/error";
import sleep from "./lib/sleep";

class StateStore {
  // 0: The state is idle and ready to take new runs
  // 1: The state is working and not ready to take new runs
  state: Record<string, 0 | 1> = {};
  queue: Record<string, string[]> = {};

  async setState(id: string, state: 0 | 1) {
    this.state[id] = state;
  }

  getState(id: string) {
    return this.state[id];
  }

  checkState(id: string): boolean {
    return this.state[id] === 0 ? true : false;
  }

  async queueRun(id: string, run_id: string, timeout?: number) {
    if (!this.queue[id]) {
      this.queue[id] = [];
    }

    this.queue[id].push(run_id);

    let total_sleep: number = 0;
    while (this.state[id] !== 0 && this.queue[id].indexOf(run_id) === 0) {
      await sleep(10);
      total_sleep += 10;

      if (typeof timeout === "number" && total_sleep >= timeout) {
        throw new Error(
          new_error(
            "run_timeout_reached",
            `The run queue timeout of ${timeout}ms has been reached`,
            "run_queue",
          ),
        );
      }
    }

    this.setState(id, 1);
  }
}

export default StateStore;
