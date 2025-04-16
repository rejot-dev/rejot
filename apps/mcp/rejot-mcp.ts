import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { IMcpServer, ToolCallback } from "./interfaces/mcp-server.interface";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { McpState } from "./state/mcp-state";
import type { ZodRawShape } from "zod";
import { ReJotMcpError } from "./state/mcp-error";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ILogger } from "@rejot-dev/contract/logger";

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
      (data: { [x: string]: unknown }, extra: RequestHandlerExtra) => {
        try {
          return cb(data, extra);
        } catch (error) {
          if (error instanceof ReJotMcpError) {
            this.#logger.warn(`Tool ${name} returned error: ${error.message}`);
            return {
              content: error.toContent(),
            };
          }

          this.#logger.error(`Unhandled error in tool ${name}: ${error}`);
          throw error;
        }
      },
    );
  }

  async #initialize(): Promise<void> {
    for (const factory of this.#factories) {
      await factory.initialize(this.#state);
    }
  }

  async #register(): Promise<void> {
    for (const factory of this.#factories) {
      await factory.register(this);
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

    if (this.#state.error) {
      // If state initialization failed, log error and throw
      const error = this.#state.error;
      const errorMessage = error?.errors
        ? `State initialization failed: ${error.message}\nErrors:\n${error.errors
            .map((e) => `- ${e.message}`)
            .join("\n")}`
        : `State initialization failed: ${error?.message ?? "Unknown error"}`;

      this.#logger.error(errorMessage);
    }
  }
}
