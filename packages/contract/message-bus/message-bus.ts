import type { Cursor } from "../cursor/cursors.ts";
import type { TransformedOperationWithSource } from "../event-store/event-store.ts";

export interface OperationMessage {
  transactionId: string;
  operations: TransformedOperationWithSource[];
}

export interface IMessageBus extends IPublishMessageBus, ISubscribeMessageBus {}

export interface IPublishMessageBus {
  publish(message: OperationMessage): Promise<void>;

  prepare(): Promise<void>;
  stop(): Promise<void>;
  close(): Promise<void>;
}

export interface ISubscribeMessageBus {
  setInitialCursors(cursors: Cursor[]): void;
  subscribe(): AsyncIterableIterator<OperationMessage>;

  prepare(): Promise<void>;
  stop(): Promise<void>;
  close(): Promise<void>;
}

export class InMemoryMessageBus implements IMessageBus {
  private messages: OperationMessage[] = [];
  private messagePromise: Promise<OperationMessage> | null = null;
  private messageResolver: ((message: OperationMessage) => void) | null = null;
  private messageReject: ((reason?: Error) => void) | null = null;
  private isRunning = true;

  async publish(message: OperationMessage): Promise<void> {
    this.messages.push(message);
    if (this.messageResolver) {
      this.messageResolver(message);
      this.messagePromise = null;
      this.messageResolver = null;
      this.messageReject = null;
    }
  }

  setInitialCursors(_cursors: Cursor[]): void {
    //
  }

  async *subscribe(): AsyncIterableIterator<OperationMessage> {
    let currentIndex = 0;

    // First, yield all existing messages
    while (currentIndex < this.messages.length) {
      yield this.messages[currentIndex++];
    }

    // Then wait for new messages
    while (this.isRunning) {
      if (!this.messagePromise) {
        this.messagePromise = new Promise((resolve, reject) => {
          this.messageResolver = resolve;
          this.messageReject = reject;
        });
      }
      try {
        const message = await this.messagePromise;
        yield message;
      } catch {
        // If the promise is rejected (during stop), we just return
        return;
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.messageReject) {
      // When stopping, we reject the promise to end the iteration
      this.messageReject(new Error("Message bus stopped"));
    }
  }

  async prepare(): Promise<void> {
    // No preparation needed for in-memory message bus
  }

  async close(): Promise<void> {
    // No closing needed for in-memory message bus
  }
}
