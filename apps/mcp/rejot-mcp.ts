import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defaultLogger, type ILogger } from "./logging/log";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { IMcpServer } from "./interfaces/mcp-server.interface";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

// Factory interface for initializers
export interface IFactory {
  initialize(mcp: IRejotMcp): void | Promise<void>;
}

/**
 * Interface for RejotMcp to allow for mocking
 */
export interface IRejotMcp {
  projectDir: string;
  server: IMcpServer;
  connect(transport: Transport): Promise<void>;
}

export class RejotMcp implements IRejotMcp {
  #server: McpServer;
  #projectDir: string;
  #factories: IFactory[];
  #logger: ILogger;

  constructor(projectDir: string, factories: IFactory[], logger: ILogger = defaultLogger) {
    this.#projectDir = projectDir;
    this.#logger = logger;
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
          `,
      },
    );

    this.#factories = factories;
  }

  get projectDir(): string {
    return this.#projectDir;
  }

  get server(): IMcpServer {
    return this.#server;
  }

  async connect(transport: Transport = new StdioServerTransport()) {
    for (const factory of this.#factories) {
      await factory.initialize(this);
    }

    this.#logger.info(`ReJot MCP server initialized for project ${this.#projectDir}`);

    await this.#server.connect(transport);

    this.#logger.info(`ReJot MCP server connected to ${this.#projectDir}`);
  }
}
