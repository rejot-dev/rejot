import { tokens } from "typed-inject";

import type {
  IPublicSchemaRepository,
  Transformation,
} from "@/public-schema/public-schema-repository";

type OperationType = "insert" | "update" | "delete";

type Operation = {
  type: OperationType;
} & (
  | {
      type: "insert";
      table: string;
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "update";
      table: string;
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "delete";
      keyColumns: string[];
      table: string;
    }
);

type ChangesTransaction = {
  operations: Operation[];
};

type CommitChangesParams = {
  connectionId: number;
  changes: ChangesTransaction;
};

type OperationWithTransformation = {
  publicSchemaId: number;
  operation: Operation;
  transformation: Transformation;
};

export interface IChangesService {
  getTransformationsForOperations(
    params: CommitChangesParams,
  ): Promise<OperationWithTransformation[]>;
}

export class ChangesService implements IChangesService {
  static inject = tokens("publicSchemaRepository");

  #publicSchemaRepository: IPublicSchemaRepository;

  constructor(publicSchemaRepository: IPublicSchemaRepository) {
    this.#publicSchemaRepository = publicSchemaRepository;
  }

  async getTransformationsForOperations({
    connectionId,
    changes,
  }: CommitChangesParams): Promise<OperationWithTransformation[]> {
    // Group operations by entity (table + key values)
    const lastOperationByEntity = new Map<string, Operation>();

    for (const operation of changes.operations) {
      if (operation.type === "delete") {
        continue; // TODO: Ignore delete operations for now
      }

      // Create a unique key for this entity based on table and key column values
      const keyValues = operation.keyColumns.map((key) => operation.new[key]);
      // TODO: This will probably be wrong when types are coerced
      const entityKey = `${operation.table}:${keyValues.join(":")}`;

      // Always keep the latest operation for an entity
      lastOperationByEntity.set(entityKey, operation);
    }

    const result: OperationWithTransformation[] = [];

    // Process each remaining operation
    for (const operation of lastOperationByEntity.values()) {
      const transformations =
        await this.#publicSchemaRepository.getPublicSchemasByConnectionAndBaseTable(
          connectionId,
          operation.table,
        );

      // Find the transformation with the highest majorVersion
      const latestTransformation = transformations.reduce<
        (Transformation & { publicSchemaId: number }) | null
      >((latest, current) => {
        if (!latest || current.majorVersion > latest.majorVersion) {
          return current;
        }
        return latest;
      }, null);

      if (latestTransformation) {
        result.push({
          publicSchemaId: latestTransformation.publicSchemaId,
          operation,
          transformation: latestTransformation,
        });
      }
    }

    return result;
  }
}
