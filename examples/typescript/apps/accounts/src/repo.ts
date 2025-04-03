import type {
  CreateAccountRequest,
  CreateAccountResponse,
  GetAccountResponse,
} from "@example/shared/accounts-api";
import type {
  CreateAddressRequest,
  CreateAddressResponse,
  GetAddressResponse,
} from "@example/shared/addresses-api";
import { Client } from "pg";
import { ResourceNotFoundError } from "@example/shared/errors";

export interface IRepo {
  createAccount(account: CreateAccountRequest): Promise<CreateAccountResponse>;
  getAccount(id: string): Promise<GetAccountResponse>;
  createAddress(address: CreateAddressRequest): Promise<CreateAddressResponse>;
  getAddress(id: string): Promise<GetAddressResponse>;
  getAccounts(): Promise<GetAccountResponse[]>;
}

export class PostgresRepo implements IRepo {
  constructor(private client: Client) {}

  async createAccount(account: CreateAccountRequest): Promise<CreateAccountResponse> {
    const result = await this.client.query(
      "INSERT INTO accounts (email, name) VALUES ($1, $2) RETURNING id",
      [account.email, account.name],
    );
    return { id: result.rows[0].id };
  }

  async getAccount(id: string): Promise<GetAccountResponse> {
    const result = await this.client.query("SELECT * FROM accounts WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      throw new ResourceNotFoundError(`Account(${id})`);
    }
    return result.rows[0];
  }

  async createAddress(address: CreateAddressRequest): Promise<CreateAddressResponse> {
    const result = await this.client.query(
      "INSERT INTO addresses (account_id, street_address, city, state, postal_code, country) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [
        address.account_id,
        address.street_address,
        address.city,
        address.state,
        address.postal_code,
        address.country,
      ],
    );
    return { id: result.rows[0].id };
  }

  async getAddress(id: string): Promise<GetAddressResponse> {
    const result = await this.client.query("SELECT * FROM addresses WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      throw new ResourceNotFoundError(`Address(${id})`);
    }
    return result.rows[0];
  }

  async getAccounts(): Promise<GetAccountResponse[]> {
    const result = await this.client.query("SELECT * FROM accounts");
    return result.rows;
  }
}
