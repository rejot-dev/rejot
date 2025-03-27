export interface PublicSchemaReference {
  manifestSlug: string;
  publicSchema: {
    name: string;
    version: {
      major: number;
    };
  };
}

export interface IConsumerDataStore {
  prepare(): Promise<void>;
  stop(): Promise<void>;
}
