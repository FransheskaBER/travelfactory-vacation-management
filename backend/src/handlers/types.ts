import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { APIGatewayProxyStructuredResultV2 } from "commoneventframework";

export type InputParserFn = (event: CommonEvent) => any;
export type HandlerFn = (input: any, event: CommonEvent) => Promise<APIGatewayProxyStructuredResultV2 | object>;