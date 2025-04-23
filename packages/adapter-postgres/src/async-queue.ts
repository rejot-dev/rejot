export class AsyncQueueAbortedError extends Error {
  name = "AsyncQueueAbortedError";
}

export class AsyncQueue<T> {
  readonly #abortSignal?: AbortSignal;

  #queue: T[] = [];
  #waitingPromises: Array<{
    resolve: (value: T) => void;
    reject: (reason?: AsyncQueueAbortedError) => void;
  }> = [];
  #isAborted = false;

  constructor(abortSignal?: AbortSignal) {
    this.#abortSignal = abortSignal;

    if (this.#abortSignal?.aborted) {
      this.#handleAbort();
    } else {
      this.#abortSignal?.addEventListener("abort", () => this.#handleAbort());
    }
  }

  #handleAbort() {
    this.#isAborted = true;

    const waitingPromises = this.#waitingPromises;
    this.#waitingPromises = [];

    // For each waiting resolver, reject the associated promise
    for (const { reject } of waitingPromises) {
      reject(new AsyncQueueAbortedError());
    }
  }

  enqueue(item: T) {
    const prevResolve = this.#waitingPromises.shift();
    if (prevResolve) {
      prevResolve.resolve(item);
    } else {
      this.#queue.push(item);
    }
  }

  dequeue(): Promise<T> {
    // If already aborted, immediately return a rejected promise
    if (this.#isAborted) {
      return Promise.reject(new AsyncQueueAbortedError());
    }

    return new Promise((resolve, reject) => {
      const item = this.#queue.shift();
      if (item) {
        resolve(item);
      } else {
        this.#waitingPromises.push({ resolve, reject });
      }
    });
  }
}
