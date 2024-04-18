class StateStore {

  state: Record<string, 0 | 1> = {};

  constructor() {}

  setState(id: string, state: 0 | 1) {
    this.state[id] = state;
  }

  getState(id: string) {
    return this.state[id];
  }

}

export default StateStore;
