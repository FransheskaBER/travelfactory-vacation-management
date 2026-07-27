import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { InputParserFn, HandlerFn } from "./types";

// --- GET /hello ---

export const getHello: HandlerFn = async () => {
	return { message: "Hello, World!" };
};

// --- GET /hello/:name ---

interface HelloByNameInput {
	name: string;
}

export const parseHelloByNameInput: InputParserFn = (event: CommonEvent) => {
	const name = event.pathParameters?.name;
	if (!name) {
		return new Response(400, { error: "Missing path parameter: name" });
	}
	return { name } as HelloByNameInput;
};

export const getHelloByName: HandlerFn = async (input: HelloByNameInput) => {
	return { message: `Hello, ${input.name}!` };
};
