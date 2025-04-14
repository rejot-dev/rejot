import type {
  ResourceTemplate,
  ResourceMetadata as ActualResourceMetadata,
  ReadResourceCallback as ActualReadResourceCallback,
  ReadResourceTemplateCallback as ActualReadResourceTemplateCallback,
  ListResourcesCallback as ActualListResourcesCallback,
  ToolCallback as ActualToolCallback,
  PromptCallback as ActualPromptCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ZodRawShape, ZodType, ZodOptional } from "zod";

/**
 * URL variables from a resource template
 */
export type Variables = Record<string, string>;

// Re-export the types we need from the actual McpServer implementation
export type ResourceMetadata = ActualResourceMetadata;
export type ReadResourceCallback = ActualReadResourceCallback;
export type ReadResourceTemplateCallback = ActualReadResourceTemplateCallback;
export type ListResourcesCallback = ActualListResourcesCallback;
export type ToolCallback<T extends ZodRawShape | undefined = undefined> = ActualToolCallback<T>;

// Define our own PromptArgsRawShape type since it's not exported from the module
export type PromptArgsRawShape = {
  [k: string]: ZodType<string> | ZodOptional<ZodType<string>>;
};

export type PromptCallback<T extends PromptArgsRawShape | undefined = undefined> =
  ActualPromptCallback<T>;
export type { ResourceTemplate };

/**
 * Type for resource list handler
 */
export type ResourceListHandler = () => {
  resources: Array<{
    name: string;
    uri: string;
    description: string;
  }>;
};

/**
 * Type for resource get handler
 */
export type ResourceGetHandler = (params: Record<string, string>) => unknown;

/**
 * Interface for McpServer that will be returned from RejotMcp
 * This extends directly from the actual McpServer type to ensure
 * we have compatible method signatures
 */
export interface IMcpServer {
  /**
   * Attaches to the given transport, starts it, and starts listening for messages.
   */
  connect(transport: Transport): Promise<void>;

  /**
   * Closes the connection.
   */
  close(): Promise<void>;

  /**
   * Registers a resource `name` at a fixed URI, which will use the given callback to respond to read requests.
   */
  resource(name: string, uri: string, readCallback: ReadResourceCallback): void;

  /**
   * Registers a resource `name` at a fixed URI with metadata, which will use the given callback to respond to read requests.
   */
  resource(
    name: string,
    uri: string,
    metadata: ResourceMetadata,
    readCallback: ReadResourceCallback,
  ): void;

  /**
   * Registers a resource `name` with a template pattern, which will use the given callback to respond to read requests.
   */
  resource(
    name: string,
    template: ResourceTemplate,
    readCallback: ReadResourceTemplateCallback,
  ): void;

  /**
   * Registers a resource `name` with a template pattern and metadata, which will use the given callback to respond to read requests.
   */
  resource(
    name: string,
    template: ResourceTemplate,
    metadata: ResourceMetadata,
    readCallback: ReadResourceTemplateCallback,
  ): void;

  /**
   * Registers a zero-argument tool `name`, which will run the given function when the client calls it.
   */
  tool(name: string, cb: ToolCallback): void;

  /**
   * Registers a zero-argument tool `name` (with a description) which will run the given function when the client calls it.
   */
  tool(name: string, description: string, cb: ToolCallback): void;

  /**
   * Registers a tool `name` accepting the given arguments, which must be an object containing named properties associated with Zod schemas.
   * When the client calls it, the function will be run with the parsed and validated arguments.
   */
  tool<Args extends ZodRawShape>(name: string, paramsSchema: Args, cb: ToolCallback<Args>): void;

  /**
   * Registers a tool `name` (with a description) accepting the given arguments, which must be an object containing named properties associated with Zod schemas.
   * When the client calls it, the function will be run with the parsed and validated arguments.
   */
  tool<Args extends ZodRawShape>(
    name: string,
    description: string,
    paramsSchema: Args,
    cb: ToolCallback<Args>,
  ): void;

  /**
   * Registers a zero-argument prompt `name`, which will run the given function when the client calls it.
   */
  prompt(name: string, cb: PromptCallback): void;

  /**
   * Registers a zero-argument prompt `name` (with a description) which will run the given function when the client calls it.
   */
  prompt(name: string, description: string, cb: PromptCallback): void;

  /**
   * Registers a prompt `name` accepting the given arguments, which must be an object containing named properties associated with Zod schemas.
   * When the client calls it, the function will be run with the parsed and validated arguments.
   */
  prompt<Args extends PromptArgsRawShape>(
    name: string,
    argsSchema: Args,
    cb: PromptCallback<Args>,
  ): void;

  /**
   * Registers a prompt `name` (with a description) accepting the given arguments, which must be an object containing named properties associated with Zod schemas.
   * When the client calls it, the function will be run with the parsed and validated arguments.
   */
  prompt<Args extends PromptArgsRawShape>(
    name: string,
    description: string,
    argsSchema: Args,
    cb: PromptCallback<Args>,
  ): void;
}
