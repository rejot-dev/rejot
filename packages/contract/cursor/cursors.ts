import type { OperationMessage } from "../message-bus/message-bus.ts";

export interface PublicSchemaReference {
  manifest: {
    slug: string;
  };
  schema: {
    name: string;
    version: { major: number };
  };
}

export interface Cursor {
  schema: PublicSchemaReference;
  transactionId: string | null;
}

export function publicSchemaReferenceToString(reference: PublicSchemaReference): string {
  return `${reference.manifest.slug}->${reference.schema.name}@${reference.schema.version.major}`;
}

export function cursorToString(cursor: Cursor): string {
  return `${publicSchemaReferenceToString(cursor.schema)} = ${cursor.transactionId}`;
}

export class Cursors {
  #cursors: Map<string, Cursor> = new Map();

  constructor(cursors: Cursor[]) {
    for (const cursor of cursors) {
      const key = publicSchemaReferenceToString(cursor.schema);

      const existingCursor = this.#cursors.get(key);

      if (
        !existingCursor ||
        !existingCursor.transactionId ||
        (cursor.transactionId && cursor.transactionId > existingCursor.transactionId)
      ) {
        this.#cursors.set(key, cursor);
      }
    }
  }

  getTransactionId(reference: PublicSchemaReference): string | null {
    const cursor = this.#cursors.get(publicSchemaReferenceToString(reference));

    if (!cursor) {
      return null;
    }

    return cursor.transactionId;
  }

  advance(reference: PublicSchemaReference, transactionId: string): void {
    const cursor = this.#cursors.get(publicSchemaReferenceToString(reference));

    if (cursor) {
      cursor.transactionId = transactionId;
    } else {
      this.#cursors.set(publicSchemaReferenceToString(reference), {
        schema: reference,
        transactionId,
      });
    }
  }

  advanceWithMessages(messages: OperationMessage[]): void {
    for (const { transactionId, operations } of messages) {
      for (const operation of operations) {
        this.advance(
          {
            manifest: {
              slug: operation.sourceManifestSlug,
            },
            schema: operation.sourcePublicSchema,
          },
          transactionId,
        );
      }
    }
  }

  toArray(): Cursor[] {
    return Array.from(this.#cursors.values());
  }
}
