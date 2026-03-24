type Controller = ReadableStreamDefaultController;

const boardSubscribers = new Map<string, Set<Controller>>();

export function subscribe(boardId: string, controller: Controller): void {
  if (!boardSubscribers.has(boardId)) {
    boardSubscribers.set(boardId, new Set());
  }
  boardSubscribers.get(boardId)!.add(controller);
}

export function unsubscribe(boardId: string, controller: Controller): void {
  const subscribers = boardSubscribers.get(boardId);
  if (!subscribers) return;
  subscribers.delete(controller);
  if (subscribers.size === 0) {
    boardSubscribers.delete(boardId);
  }
}

export function broadcast(boardId: string, payload: Record<string, unknown>): void {
  const subscribers = boardSubscribers.get(boardId);
  if (!subscribers || subscribers.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const encoder = new TextEncoder();
  for (const controller of subscribers) {
    try {
      controller.enqueue(encoder.encode(data));
    } catch {
      // Controller may be closed; remove it
      subscribers.delete(controller);
    }
  }
}
