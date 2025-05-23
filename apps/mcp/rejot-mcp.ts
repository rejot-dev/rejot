import type { ZodRawShape } from "zod";

import { ReJotError } from "@rejot-dev/contract/error";
import { getLogger, LogLevel } from "@rejot-dev/contract/logger";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type {
  ReadResourceResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

import type {
  IMcpServer,
  ReadResourceTemplateCallback,
  ResourceTemplate,
  ToolCallback,
} from "./interfaces/mcp-server.interface.ts";
import { rejotErrorToCallToolContent, rejotErrorToReadResourceContent } from "./state/mcp-error.ts";
import { McpState } from "./state/mcp-state.ts";

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
  workspaceDirectoryPath: string;
  server: IMcpServer;
  state: McpState;
  connect(projectDir: string, transport: Transport): Promise<void>;

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

const log = getLogger(import.meta.url);

export class RejotMcp implements IRejotMcp {
  #server: IMcpServer;
  #factories: IFactory[];
  #state: McpState | undefined;

  constructor(server: IMcpServer, factories: IFactory[]) {
    this.#factories = factories;
    this.#server = server;
  }

  get workspaceDirectoryPath(): string {
    if (!this.#state) {
      throw new Error("ReJotMcp not connected.");
    }
    return this.#state.workspaceDirectoryPath;
  }

  get server(): IMcpServer {
    return this.#server;
  }

  get state(): McpState {
    if (!this.#state) {
      throw new Error("ReJotMcp not connected.");
    }

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
          const content = rejotErrorToCallToolContent(error);
          if (content) {
            const errorMessage = error instanceof ReJotError ? error.message : "Unknown error";
            log.warn("Error converted to resource content: " + errorMessage);
            log.logErrorInstance(error, LogLevel.WARN);
            return {
              content,
            };
          }

          log.error(`Unhandled error in tool ${name}`);
          log.logErrorInstance(error);
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
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
      ): Promise<ReadResourceResult> => {
        try {
          return handler(uri, variables, extra);
        } catch (error) {
          const content = rejotErrorToReadResourceContent(error, uri.toString());
          if (content) {
            const errorMessage = error instanceof ReJotError ? error.message : "Unknown error";
            log.warn("Error converted to resource content: " + errorMessage);
            log.logErrorInstance(error, LogLevel.WARN);
            return {
              contents: content,
            };
          }

          log.error(`Unhandled error in resource ${name}: ${error}`);
          throw error;
        }
      },
    );
  }

  async #initialize(): Promise<void> {
    if (!this.#state) {
      throw new Error("State not set.");
    }

    for (const factory of this.#factories) {
      try {
        await factory.initialize(this.#state);
      } catch (error) {
        if (error instanceof ReJotError) {
          log.warn("Initialization error", {
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
    if (!this.#state) {
      throw new Error("State not set.");
    }

    for (const factory of this.#factories) {
      try {
        await factory.register(this);
      } catch (error) {
        if (error instanceof ReJotError) {
          this.#state.addInitializationError(error);
        } else {
          throw error;
        }
      }
    }
  }

  async connect(projectDir: string, transport: Transport = new StdioServerTransport()) {
    this.#state = new McpState(projectDir);

    // Initialize state first
    await this.#initialize();

    // Only proceed with registration if state is ready
    await this.#register();

    log.info(`ReJot MCP server initialized for project ${this.workspaceDirectoryPath}`);
    await this.#server.connect(transport);
    log.info(`ReJot MCP server connected to ${this.workspaceDirectoryPath}`);

    if (this.#state.initializationErrors.length > 0) {
      log.warn("State initialization failed:");
      for (const error of this.#state.initializationErrors) {
        log.warn(`  - ${error.message}`);
      }
    }
  }
}
