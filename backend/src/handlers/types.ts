import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { APIGatewayProxyStructuredResultV2 } from "commoneventframework";

// `any` is deliberate in both signatures: it lets each handler declare its
// concrete input type while staying assignable to HandlerFn. `unknown` would
// reject every typed handler under strictFunctionTypes (contravariance).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputParserFn = (event: CommonEvent) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerFn = (input: any, event: CommonEvent) => Promise<APIGatewayProxyStructuredResultV2 | object>;