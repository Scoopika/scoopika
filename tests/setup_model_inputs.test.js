"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var setup_model_inputs_1 = __importDefault(require("../src/lib/setup_model_inputs"));
(0, vitest_1.test)("LLM inputs with no tools", function () {
    var inputs = (0, setup_model_inputs_1.default)({
        model: "test_model",
        tools: [],
        options: {},
        messages: [
            { role: "user", content: "Hello" },
            { role: "model", content: "Hey" },
        ],
    });
    (0, vitest_1.expect)(inputs.model).toBe("test_model");
    (0, vitest_1.expect)(inputs.tools).toBe(undefined);
    (0, vitest_1.expect)(inputs.tool_choice).toBe(undefined);
    (0, vitest_1.expect)(inputs.messages.length).toBe(2);
});
(0, vitest_1.test)("LLM inputs with tools", function () {
    var _a;
    var inputs = (0, setup_model_inputs_1.default)({
        model: "test_model",
        options: {},
        messages: [],
        tools: [
            {
                type: "function",
                function: {
                    name: "func",
                    description: "this is a function tool",
                    parameters: {
                        type: "object",
                        properties: {
                            input: {
                                type: "string",
                            },
                        },
                        required: ["input"],
                    },
                },
            },
        ],
    });
    (0, vitest_1.expect)(typeof inputs.tools).toBe("object");
    (0, vitest_1.expect)((_a = inputs.tools) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
    (0, vitest_1.expect)(inputs.tool_choice).toBe("auto");
});
(0, vitest_1.test)("LLM inputs with schema", function () {
    var _a, _b;
    var inputs = (0, setup_model_inputs_1.default)({
        model: "test_model",
        options: {},
        messages: [],
        tools: [],
        response_format: {
            type: "json_object",
            schema: {
                type: "object",
                properties: {
                    input: { type: "string" },
                },
                required: ["input"],
            },
        },
    });
    (0, vitest_1.expect)((_a = inputs.response_format) === null || _a === void 0 ? void 0 : _a.type).toBe("json_object");
    (0, vitest_1.expect)(typeof ((_b = inputs.response_format) === null || _b === void 0 ? void 0 : _b.schema)).toBe("object");
});
