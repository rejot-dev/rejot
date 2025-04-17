import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  IMcpServer,
  ReadResourceTemplateCallback,
  ResourceTemplate,
  ToolCallback,
} from "./interfaces/mcp-server.interface";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { McpState } from "./state/mcp-state";
import type { ZodRawShape } from "zod";
import { ReJotMcpError } from "./state/mcp-error";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ILogger } from "@rejot-dev/contract/logger";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

// Factory interface for initializers
export interface IFactory {
  /**
   * Initialize the factory's state. This will be called in a specific order
   * defined by the main entry point.
   */
  initialize(state: McpState): Promise<void>;

  /**
   * Register any tools or resources with the MCP server.
   * This will be called after all factories have been initialized.
   */
  register(mcp: IRejotMcp): Promise<void>;
}

/**
 * Interface for RejotMcp to allow for mocking
 */
export interface IRejotMcp {
  projectDir: string;
  server: IMcpServer;
  state: McpState;
  connect(transport: Transport): Promise<void>;

  registerTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    paramsSchema: Args,
    cb: ToolCallback<Args>,
  ): void;

  registerResource(
    name: string,
    template: ResourceTemplate,
    handler: ReadResourceTemplateCallback,
  ): void;
}

export class RejotMcp implements IRejotMcp {
  #server: McpServer;
  #factories: IFactory[];
  #logger: ILogger;
  #state: McpState;

  constructor(projectDir: string, logger: ILogger, factories: IFactory[]) {
    this.#logger = logger;
    this.#factories = factories;
    this.#state = new McpState(projectDir);

    this.#server = new McpServer(
      {
        name: "@rejot-dev/mcp",
        version: "0.0.7",
      },
      {
        instructions: `
    This is the ReJot MCP server. ReJot provides a set of tools to facilitate micro-service
    communication. As opposed to traditional approaches like REST APIs, ReJot operates on the database
    layer.
    
    In the ReJot manifest, teams define their database connection details, as well as the entities they
    publish to other teams. These are called 'public schemas' and they're strongly tied to a version and
    contract. Other teams can subscribe to these schemas using a consumer schema.

    ALWAYS use the tools in this MCP to edit the manifest.

    - In most cases it makes sense to get the workspace's manifest information first.
    - If you do not know a connection's slug. Get the workspace manifest first.
    - You don't have to check health before doing other operations.
          `,
      },
    );
  }

  get projectDir(): string {
    return this.#state.projectDir;
  }

  get server(): IMcpServer {
    return this.#server;
  }

  get state(): McpState {
    return this.#state;
  }

  registerTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    paramsSchema: Args,
    cb: ToolCallback<Args>,
  ): void {
    this.#server.tool(
      name,
      description,
      paramsSchema,
      // @ts-expect-error: Seems to be an error in MCP library
      async (data: { [x: string]: unknown }, extra: RequestHandlerExtra) => {
        try {
          return await cb(data, extra);
        } catch (error) {
          if (error instanceof ReJotMcpError) {
            this.#logger.warn(`Tool ${name} returned error: ${error.message}`);
            return {
              content: error.toCallToolContent(),
            };
          }

          this.#logger.error(`Unhandled error in tool ${name}`);
          this.#logger.logErrorInstance(error);
          throw error;
        }
      },
    );
  }

  registerResource(
    name: string,
    template: ResourceTemplate,
    handler: ReadResourceTemplateCallback,
  ): void {
    this.#server.resource(
      name,
      template,
      async (
        uri: URL,
        variables: Variables,
        extra: RequestHandlerExtra,
      ): Promise<ReadResourceResult> => {
        try {
          return handler(uri, variables, extra);
        } catch (error) {
          if (error instanceof ReJotMcpError) {
            return {
              contents: error.toReadResourceContent(uri.toString()),
            };
          }

          this.#logger.error(`Unhandled error in resource ${name}: ${error}`);
          throw error;
        }
      },
    );
  }

  async #initialize(): Promise<void> {
    for (const factory of this.#factories) {
      try {
        await factory.initialize(this.#state);
      } catch (error) {
        if (error instanceof ReJotMcpError) {
          this.#logger.warn("Initialization error", {
            error: error.message,
          });
          this.#state.addInitializationError(error);
        } else {
          throw error;
        }
      }
    }
  }

  async #register(): Promise<void> {
    for (const factory of this.#factories) {
      try {
        await factory.register(this);
      } catch (error) {
        if (error instanceof ReJotMcpError) {
          this.#state.addInitializationError(error);
        } else {
          throw error;
        }
      }
    }
  }

  async connect(transport: Transport = new StdioServerTransport()) {
    // Initialize state first
    await this.#initialize();

    // Only proceed with registration if state is ready
    await this.#register();

    this.#logger.info(`ReJot MCP server initialized for project ${this.projectDir}`);
    await this.#server.connect(transport);
    this.#logger.info(`ReJot MCP server connected to ${this.projectDir}`);

    if (this.#state.initializationErrors.length > 0) {
      this.#logger.warn("State initialization failed:");
      for (const error of this.#state.initializationErrors) {
        this.#logger.warn(`  - ${error.message}`);
      }
    }
  }
}
