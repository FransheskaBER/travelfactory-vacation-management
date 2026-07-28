import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { InputParserFn, HandlerFn } from "./types";
import { requireRole } from "../auth/requireRole";
import { UserRole } from "../entities/User";

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

// TEMP (spec 4.2 §8 Q2): guard demo proving requireRole works wired through
// CEF's x-handler resolution — reverted in 4.6 when real protected routes
// exist (checklist 4.6 carries the revert).
export const getHelloByName: HandlerFn = requireRole(
	UserRole.Validator,
	async (input: HelloByNameInput) => {
		return { message: `Hello, ${input.name}!` };
	}
);
