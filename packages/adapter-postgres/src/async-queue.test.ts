import { expect, test } from "bun:test";

import { AsyncQueue, AsyncQueueAbortedError } from "./async-queue";

test("AsyncQueue - enqueue and dequeue in order", async () => {
  const controller = new AbortController();
  const queue = new AsyncQueue<number>(controller.signal);
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);

  expect(await queue.dequeue()).toBe(1);
  expect(await queue.dequeue()).toBe(2);
  expect(await queue.dequeue()).toBe(3);
});

test("AsyncQueue - dequeue waits for enqueue", async () => {
  const controller = new AbortController();
  const queue = new AsyncQueue<string>(controller.signal);

  // Start dequeuing before any items are available
  const dequeuePromise = queue.dequeue();

  // Small delay to ensure dequeue is waiting
  await new Promise((resolve) => setTimeout(resolve, 10));

  queue.enqueue("test");

  expect(await dequeuePromise).toBe("test");
});

test("AsyncQueue - multiple waiting dequeues resolve in order", async () => {
  const controller = new AbortController();
  const queue = new AsyncQueue<number>(controller.signal);

  const results: number[] = [];

  // Create three dequeue promises
  const promise1 = queue.dequeue().then((value: number) => results.push(value));
  const promise2 = queue.dequeue().then((value: number) => results.push(value));
  const promise3 = queue.dequeue().then((value: number) => results.push(value));

  // Small delay to ensure all dequeues are waiting
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Enqueue items
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);

  // Wait for all promises to resolve
  await Promise.all([promise1, promise2, promise3]);

  expect(results).toEqual([1, 2, 3]);
});

test("AsyncQueue - mixed enqueue/dequeue operations", async () => {
  const controller = new AbortController();
  const queue = new AsyncQueue<string>(controller.signal);

  // Enqueue first item
  queue.enqueue("first");

  // Start dequeuing two items (one available, one not yet)
  const dequeue1 = queue.dequeue();
  const dequeue2 = queue.dequeue();

  // Small delay
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Enqueue second item
  queue.enqueue("second");

  // Both dequeues should complete
  expect(await dequeue1).toBe("first");
  expect(await dequeue2).toBe("second");
});

test("AsyncQueue - handles different data types", async () => {
  type TestData = number | string | Record<string, string> | number[];
  const controller = new AbortController();
  const queue = new AsyncQueue<TestData>(controller.signal);

  queue.enqueue(42);
  queue.enqueue("string");
  queue.enqueue({ key: "value" });
  queue.enqueue([1, 2, 3]);

  expect(await queue.dequeue()).toBe(42);
  expect(await queue.dequeue()).toBe("string");
  expect(await queue.dequeue()).toEqual({ key: "value" });
  expect(await queue.dequeue()).toEqual([1, 2, 3]);
});

test("AsyncQueue - aborts waiting dequeues when signal is aborted", async () => {
  const controller = new AbortController();
  const queue = new AsyncQueue<string>(controller.signal);

  // Start dequeuing with no items available
  const dequeuePromise = queue.dequeue();

  // Small delay to ensure dequeue is waiting
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Abort the controller
  controller.abort();

  // The dequeue promise should reject with an AsyncQueueAbortedError
  await expect(dequeuePromise).rejects.toBeInstanceOf(AsyncQueueAbortedError);
});
