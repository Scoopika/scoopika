type Input = string | number | boolean | Array<string | number | boolean>;

type Inputs = Record<string, Input>;

interface SuccessResponse {
  success: true;
  value: Input;
}

interface FailedResponse {
  success: false;
  errors: Array<string>;
}

type FuncResponse = SuccessResponse | FailedResponse;
