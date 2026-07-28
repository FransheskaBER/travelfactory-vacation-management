// Domain event pub/sub (spec 4.3 §8 Q2, Q3): emitters announce what already
// happened; listeners react and can never gate or reverse it (ADR 0001).

export type EventClass<TEvent> = new (...args: never[]) => TEvent;
export type EventListener<TEvent> = (event: TEvent) => void | Promise<void>;

export class EventDispatcher {
  // Keyed by class constructor. Values are type-erased to `unknown`; the
  // subscribe() signature guarantees a listener only ever receives
  // instances of the class it registered under.
  private readonly listeners = new Map<
    EventClass<unknown>,
    Array<EventListener<unknown>>
  >();

  subscribe<TEvent extends object>(
    eventClass: EventClass<TEvent>,
    listener: EventListener<TEvent>
  ): void {
    const registered = this.listeners.get(eventClass) ?? [];
    registered.push(listener as EventListener<unknown>);
    this.listeners.set(eventClass, registered);
  }

  // Never rejects: the emitting operation is already committed, so a broken
  // listener must not fail it — failures are logged and swallowed.
  async emit(event: object): Promise<void> {
    const eventClass = event.constructor as EventClass<unknown>;
    for (const listener of this.listeners.get(eventClass) ?? []) {
      try {
        await listener(event);
      } catch (err) {
        console.error(`[events] listener for ${eventClass.name} failed:`, err);
      }
    }
  }
}

export const eventDispatcher = new EventDispatcher();
