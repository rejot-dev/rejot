import { describe, test, expect } from "bun:test";
import { InMemorySource } from "./in-memory-source";
import type { Transaction } from "@rejot/contract/sync";

describe("InMemorySource", () => {
  test("should yield transactions in order they were posted", async () => {
    const source = new InMemorySource();
    const iterator = source.startIteration(new AbortController().signal);

    const transaction1: Transaction = {
      id: "1",
      operations: [],
      ack: () => {},
    };

    const transaction2: Transaction = {
      id: "2",
      operations: [],
      ack: () => {},
    };

    source.postTransaction(transaction1);
    source.postTransaction(transaction2);

    const result1 = await iterator.next();
    const result2 = await iterator.next();

    expect(result1.done).toBe(false);
    expect(result1.value).toBe(transaction1);
    expect(result2.done).toBe(false);
    expect(result2.value).toBe(transaction2);
  });

  test("should wait for transactions when none are available", async () => {
    const source = new InMemorySource();
    const iterator = source.startIteration(new AbortController().signal);

    const transaction: Transaction = {
      id: "1",
      operations: [],
      ack: () => {},
    };

    // Start getting next value before posting transaction
    const resultPromise = iterator.next();

    // Small delay to ensure we're waiting
    await new Promise((resolve) => setTimeout(resolve, 10));

    source.postTransaction(transaction);
    const result = await resultPromise;

    expect(result.done).toBe(false);
    expect(result.value).toBe(transaction);
  });

  test("should handle multiple concurrent iterators", async () => {
    const source = new InMemorySource();
    const iterator1 = source.startIteration(new AbortController().signal);
    const iterator2 = source.startIteration(new AbortController().signal);

    const transaction1: Transaction = {
      id: "1",
      operations: [],
      ack: () => {},
    };

    const transaction2: Transaction = {
      id: "2",
      operations: [],
      ack: () => {},
    };

    // Start getting next value from both iterators
    const promise1 = iterator1.next();
    const promise2 = iterator2.next();

    // Post transactions after both iterators are waiting
    source.postTransaction(transaction1);
    source.postTransaction(transaction2);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // First iterator should get first transaction
    expect(result1.done).toBe(false);
    expect(result1.value).toBe(transaction1);

    // Second iterator should get second transaction
    expect(result2.done).toBe(false);
    expect(result2.value).toBe(transaction2);
  });
});
