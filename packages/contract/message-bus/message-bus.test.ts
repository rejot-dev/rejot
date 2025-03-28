import { test, expect } from "bun:test";
import { InMemoryMessageBus } from "./message-bus";
import type { OperationMessage } from "./message-bus";

const createTestMessage = (_id: number): OperationMessage => ({
  operations: [],
});

test("should publish and receive messages", async () => {
  const messageBus = new InMemoryMessageBus();
  const message = createTestMessage(1);

  // Start subscription before publishing
  const subscription = messageBus.subscribe();
  await messageBus.publish(message);

  const receivedMessage = await subscription.next();
  expect(receivedMessage.value).toEqual(message);
});

test("should receive historical messages", async () => {
  const messageBus = new InMemoryMessageBus();
  const message1 = createTestMessage(1);
  const message2 = createTestMessage(2);

  // Publish messages before subscribing
  await messageBus.publish(message1);
  await messageBus.publish(message2);

  const subscription = messageBus.subscribe();

  const received1 = await subscription.next();
  const received2 = await subscription.next();

  expect(received1.value).toEqual(message1);
  expect(received2.value).toEqual(message2);
});

test("should stop receiving messages after stop is called", async () => {
  const messageBus = new InMemoryMessageBus();
  const subscription = messageBus.subscribe();

  // Create a promise that will resolve when the message is received
  const messagePromise = subscription.next();

  // Stop the message bus
  await messageBus.stop();

  const result = await messagePromise;
  expect(result.done).toBe(true);
});

test("should handle multiple messages in sequence", async () => {
  const messageBus = new InMemoryMessageBus();
  const subscription = messageBus.subscribe();
  const messages = [createTestMessage(1), createTestMessage(2), createTestMessage(3)];

  // Publish messages with a small delay to ensure they're processed in order
  for (const message of messages) {
    await messageBus.publish(message);
  }

  for (const expectedMessage of messages) {
    const received = await subscription.next();
    expect(received.value).toEqual(expectedMessage);
  }
});

test("should handle concurrent subscribers", async () => {
  const messageBus = new InMemoryMessageBus();
  const subscription1 = messageBus.subscribe();
  const subscription2 = messageBus.subscribe();

  const message = createTestMessage(1);
  await messageBus.publish(message);

  const received1 = await subscription1.next();
  const received2 = await subscription2.next();

  expect(received1.value).toEqual(message);
  expect(received2.value).toEqual(message);
});

test("should handle stop on empty message bus", async () => {
  const messageBus = new InMemoryMessageBus();
  const subscription = messageBus.subscribe();

  // Stop immediately without any messages published
  await messageBus.stop();

  const result = await subscription.next();
  expect(result.done).toBe(true);
  // There should be no value when done is true
  expect(result).toEqual({ done: true, value: undefined });
});
