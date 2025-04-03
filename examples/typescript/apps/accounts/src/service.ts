import { CreateAccountRequestSchema } from "@example/shared/accounts-api";
import { CreateAddressRequestSchema } from "@example/shared/addresses-api";
import { errorToResponse } from "@example/shared/errors";
import { simpleUI } from "@example/shared/simple-ui";
import type { IRepo } from "./repo";

export class AccountsService {
  private server: ReturnType<typeof Bun.serve> | null = null;

  constructor(
    private repo: IRepo,
    private port: number = 3000,
  ) {}

  async start(): Promise<void> {
    this.server = Bun.serve({
      port: this.port,
      routes: {
        "/": async () => {
          const accounts = await this.repo.getAccounts();
          const accountsMap = Object.fromEntries(accounts.map((a) => [a.id, JSON.stringify(a)]));
          return simpleUI("Account Service", accountsMap);
        },
        "/status": Response.json({ status: "OK" }),
        "/accounts/:id": {
          GET: async (req) => {
            const account = await this.repo.getAccount(req.params.id);
            return Response.json(account);
          },
        },
        "/accounts": {
          POST: async (req) => {
            const body = await req.json();
            const newAccount = CreateAccountRequestSchema.parse(body);
            const newAccountId = await this.repo.createAccount(newAccount);
            return Response.json(newAccountId);
          },
          GET: async () => {
            const accounts = await this.repo.getAccounts();
            return Response.json(accounts);
          },
        },
        "/addresses/:id": {
          GET: async (req) => {
            const address = await this.repo.getAddress(req.params.id);
            return Response.json(address);
          },
        },
        "/addresses": {
          POST: async (req) => {
            const body = await req.json();
            const newAddress = CreateAddressRequestSchema.parse(body);
            const newAddressId = await this.repo.createAddress(newAddress);
            return Response.json(newAddressId);
          },
        },
      },
      error: errorToResponse,
    });
    console.log(`Accounts service started on port ${this.port}`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
      console.log("Accounts service stopped");
    }
  }
}
