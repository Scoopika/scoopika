"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var generative_ai_1 = require("@google/generative-ai");
var agent_1 = __importDefault(require("../src/agent"));
var sleep_1 = __importDefault(require("../src/lib/sleep"));
var google_client = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
var dummy_agent = {
    id: "agent",
    name: "Agento",
    description: "Agent that help make a plan for learning new things",
    tools: [],
    prompts: [
        {
            id: "prompt-1",
            index: 0,
            model: "gemini-1.5-pro-latest",
            llm_client: "google",
            variable_name: "main3",
            options: {},
            type: "text",
            content: "Output 3 main ideas about a plan for learning <<topic>>, just 3 words and nothing else",
            inputs: [
                {
                    id: "topic",
                    description: "The learning topic",
                    type: "string",
                    required: true,
                },
            ],
        },
        {
            id: "prompt-2",
            index: 1,
            model: "gemini-1.5-pro-latest",
            llm_client: "google",
            variable_name: "descriptions",
            options: {},
            type: "text",
            content: "Output a description for each one of these 3 main ideas <<main3>> about a plan for learning <<topic>>. make the description only 3 to 4 words",
            inputs: [
                {
                    id: "topic",
                    description: "The learning topic",
                    type: "string",
                    required: true,
                },
                {
                    id: "main3",
                    description: "The 3 main ideas",
                    type: "string",
                    required: true,
                },
            ],
        },
    ],
    chained: true,
};
(0, vitest_1.test)("Chained agent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var agent, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                agent = new agent_1.default({
                    id: "agent",
                    agent: dummy_agent,
                    llmClients: [{ host: "google", client: google_client }],
                });
                return [4 /*yield*/, agent.newSession("session1", "Kais")];
            case 1:
                _a.sent();
                agent.run({
                    session_id: "session1",
                    inputs: {
                        topic: "playing guitar",
                    },
                });
                // Google now has a limit of 2 req/min so we need to sleep for a minute here
                return [4 /*yield*/, (0, sleep_1.default)(60000)];
            case 2:
                // Google now has a limit of 2 req/min so we need to sleep for a minute here
                _a.sent();
                return [4 /*yield*/, agent.run({
                        session_id: "session1",
                        inputs: {
                            message: "Can you now translate the first one to french",
                        },
                    })];
            case 3:
                run = _a.sent();
                (0, vitest_1.expect)(typeof run.responses.main3.content).toBe("string");
                (0, vitest_1.expect)(typeof run.responses.descriptions.content).toBe("string");
                (0, vitest_1.expect)(run.responses.main3.type).toBe("text");
                (0, vitest_1.expect)(run.session_id).toBe("session1");
                return [2 /*return*/];
        }
    });
}); });
