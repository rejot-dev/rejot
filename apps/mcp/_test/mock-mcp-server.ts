import { z } from "zod";
import type {
  IMcpServer,
  ToolCallback,
  ResourceTemplate,
  ReadResourceTemplateCallback,
} from "../interfaces/mcp-server.interface";
import type { ResourceListHandler, ResourceGetHandler } from "../interfaces/mcp-server.interface";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ZodRawShape } from "zod";
import { type IRejotMcp, type IFactory, RejotMcp } from "../rejot-mcp";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { McpState } from "../state/mcp-state";
import { ReJotMcpError } from "../state/mcp-error";

/**
 * Represents a registered tool in the MCP server
 */
export interface RegisteredTool {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (params: unknown) => Promise<unknown>;
}

/**
 * Represents a registered resource in the MCP server
 */
export interface RegisteredResource {
  name: string;
  template: {
    uri: string;
    handlers: {
      list?: ResourceListHandler;
      get?: ResourceGetHandler;
    };
  };
  options: {
    mimeType: string;
  };
}

/**
 * Represents a registered prompt in the MCP server
 */
export interface RegisteredPrompt {
  name: string;
  prompt: string;
}

/**
 * Mock implementation of McpServer for testing purposes
 * For simplicity, we're not trying to match all the original method signatures,
 * but rather focusing on the core functionality of storing registrations
 */
export class MockMcpServer implements Partial<IMcpServer> {
  #tools: RegisteredTool[] = [];
  #resources: RegisteredResource[] = [];
  #prompts: RegisteredPrompt[] = [];
  #metadata: { name: string; version: string };
  #serverInstructions: string;

  constructor(metadata: { name: string; version: string }, options?: { instructions?: string }) {
    this.#metadata = metadata;
    this.#serverInstructions = options?.instructions || "";
  }

  /**
   * Mock implementation for tool registration
   * Simplified to just store the registered tool information
   */
  tool(name: string, ...args: unknown[]): void {
    // Extract the description, schema, and callback based on argument types
    let description = "";
    let schema = z.object({});
    let handler = async () => ({ content: [] });

    // Parse args based on their types
    if (args.length > 0) {
      if (typeof args[0] === "string") {
        description = args[0] as string;
      } else if (typeof args[0] === "function") {
        handler = args[0] as typeof handler;
      } else if (args[0] && typeof args[0] === "object") {
        schema = z.object(args[0] as ZodRawShape);
      }
    }

    // Push the tool registration
    this.#tools.push({
      name,
      description,
      schema,
      handler: async (_params: unknown) => {
        // Handler should expect params but we don't need to use them in the mock
        return handler();
      },
    });
  }

  /**
   * Mock implementation for resource registration
   * Simplified to just store the registered resource information
   */
  resource(name: string, ...args: unknown[]): void {
    // Remove debug output for production use

    // For the mock, we extract minimal info for storage
    let uriString = "template://pattern";
    const handlers: {
      list?: ResourceListHandler;
      get?: ResourceGetHandler;
    } = {
      list: undefined,
      get: undefined,
    };
    let options = { mimeType: "application/json" };

    // Check if the first argument is a string (URI) or ResourceTemplate
    if (args.length > 0) {
      if (typeof args[0] === "string") {
        uriString = args[0] as string;
      } else if (args[0] && typeof args[0] === "object") {
        // Handle ResourceTemplate object or similar structure
        const templateArg = args[0] as Record<string, unknown>;

        // Check for ResourceTemplate with _uriTemplate property
        if ("_uriTemplate" in templateArg) {
          uriString = String(templateArg._uriTemplate);
        } else if ("uriTemplate" in templateArg) {
          uriString = String(templateArg.uriTemplate);
        } else if ("template" in templateArg) {
          uriString = String(templateArg.template);
        } else if ("pattern" in templateArg) {
          uriString = String(templateArg.pattern);
        }

        // Check for ResourceTemplate callbacks in _callbacks property
        if ("_callbacks" in templateArg && templateArg._callbacks) {
          const callbacks = templateArg._callbacks as Record<string, unknown>;
          if ("list" in callbacks && typeof callbacks.list === "function") {
            handlers.list = callbacks.list as ResourceListHandler;
          }
        }

        // Also check direct properties
        if ("list" in templateArg && typeof templateArg.list === "function") {
          handlers.list = templateArg.list as ResourceListHandler;
        }

        // And check handlers property
        if ("handlers" in templateArg && templateArg.handlers) {
          const templateHandlers = templateArg.handlers as Record<string, unknown>;
          if ("list" in templateHandlers && typeof templateHandlers.list === "function") {
            handlers.list = templateHandlers.list as ResourceListHandler;
          }
        }
      }

      // Find the options object (which should have mimeType) and determine callback position
      let callbackIndex = -1;
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg && typeof arg === "object" && "mimeType" in (arg as object)) {
          options = arg as { mimeType: string };
          callbackIndex = i + 1;
          break;
        }
      }

      // If we couldn't find options, callback would be the second arg
      if (callbackIndex === -1) {
        callbackIndex = 1;
      }

      // Check if we have a callback at the expected position
      if (callbackIndex < args.length && typeof args[callbackIndex] === "function") {
        handlers.get = args[callbackIndex] as ResourceGetHandler;
      }
    }

    this.#resources.push({
      name,
      template: {
        uri: uriString,
        handlers,
      },
      options,
    });
  }

  /**
   * Mock implementation for prompt registration
   * Simplified to just store the registered prompt information
   */
  prompt(name: string, ...args: unknown[]): void {
    // For the mock, we extract minimal info for storage
    let promptDesc = "";

    if (args.length > 0 && typeof args[0] === "string") {
      promptDesc = args[0] as string;
    } else {
      promptDesc = "(Callback or args)";
    }

    this.#prompts.push({
      name,
      prompt: promptDesc,
    });
  }

  /**
   * Mock connect method
   */
  async connect(_transport: Transport): Promise<void> {
    // No-op implementation for testing
  }

  /**
   * Mock close method
   */
  async close(): Promise<void> {
    // No-op implementation for testing
  }

  /**
   * Get all registered tools
   */
  getTools(): RegisteredTool[] {
    return [...this.#tools];
  }

  /**
   * Get all registered resources
   */
  getResources(): RegisteredResource[] {
    return [...this.#resources];
  }

  /**
   * Get all registered prompts
   */
  getPrompts(): RegisteredPrompt[] {
    return [...this.#prompts];
  }

  /**
   * Get server metadata
   */
  getMetadata(): { name: string; version: string } {
    return { ...this.#metadata };
  }

  /**
   * Get server instructions
   */
  getInstructions(): string {
    return this.#serverInstructions;
  }
}

/**
 * Mock implementation of RejotMcp for testing purposes
 */
export class MockRejotMcp extends RejotMcp implements IRejotMcp {
  #mockServer: MockMcpServer;

  #projectDir: string;
  #factories: IFactory[] = [];
  #state: McpState;

  constructor(projectDir: string, factories: IFactory[] = []) {
    const mockServer = new MockMcpServer(
      {
        name: "@rejot-dev/mcp",
        version: "0.0.1337",
      },
      {
        instructions: "",
      },
    );

    super(projectDir, mockServer, factories);

    this.#state = new McpState(projectDir);
    this.#projectDir = projectDir;
    this.#factories = factories;
    this.#mockServer = mockServer;
  }

  registerTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    paramsSchema: Args,
    cb: ToolCallback<Args>,
  ): void {
    this.server.tool(
      name,
      description,
      paramsSchema,
      (data: { [x: string]: unknown }, extra: RequestHandlerExtra) => {
        try {
          return cb(data, extra);
        } catch (error) {
          if (error instanceof ReJotMcpError) {
            return {
              content: error.toCallToolContent(),
            };
          }

          throw error;
        }
      },
    );
  }

  get projectDir(): string {
    return this.#projectDir;
  }

  get server(): MockMcpServer {
    return this.#mockServer;
  }

  get state(): McpState {
    return this.#state;
  }

  registerResource(
    name: string,
    template: ResourceTemplate,
    handler: ReadResourceTemplateCallback,
  ): void {
    this.server.resource(
      name,
      template,
      async (uri: URL, variables: Variables, extra: RequestHandlerExtra) => {
        try {
          return await handler(uri, variables, extra);
        } catch (error) {
          if (error instanceof ReJotMcpError) {
            return {
              contents: error.toReadResourceContent(uri.toString()),
            };
          }

          throw error;
        }
      },
    );
  }

  async connect(): Promise<void> {
    for (const factory of this.#factories) {
      await factory.initialize(this.#state);
    }

    for (const factory of this.#factories) {
      await factory.register(this);
    }

    // Don't need to connect to any transport in the mock
  }

  /**
   * Get all registered tools
   */
  getTools(): RegisteredTool[] {
    return this.#mockServer.getTools();
  }

  /**
   * Get all registered resources
   */
  getResources(): RegisteredResource[] {
    return this.#mockServer.getResources();
  }

  /**
   * Get all registered prompts
   */
  getPrompts(): RegisteredPrompt[] {
    return this.#mockServer.getPrompts();
  }
}
