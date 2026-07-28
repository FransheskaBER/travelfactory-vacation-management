// Thin executor (spec 4.3 §8 Q1, D14): commands stay self-executing with
// constructor-injected deps; the bus is the single choke point every
// dispatch passes through, where cross-cutting behavior attaches.

export interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}

export class CommandBus {
  async execute<TInput, TResult>(
    command: Command<TInput, TResult>,
    input: TInput
  ): Promise<TResult> {
    // Class name only, never the input — payloads can carry credentials
    // (spec 4.3 §8 Q7).
    console.debug(`[bus] dispatching ${command.constructor.name}`);
    return command.execute(input);
  }
}

export const commandBus = new CommandBus();
