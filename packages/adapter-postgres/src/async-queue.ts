export class AsyncQueue<T> {
  private queue: T[] = [];
  private waitingResolvers: Array<(value: T) => void> = [];

  enqueue(item: T) {
    const prevResolve = this.waitingResolvers.shift();
    if (prevResolve) {
      prevResolve(item);
    } else {
      this.queue.push(item);
    }
  }

  dequeue(): Promise<T> {
    return new Promise((resolve) => {
      const item = this.queue.shift();
      if (item) {
        resolve(item);
      } else {
        this.waitingResolvers.push(resolve);
      }
    });
  }
}
