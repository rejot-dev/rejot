import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { AccountsService } from "./service";
import type { CreateAccountResponse, GetAccountResponse } from "@example/shared/accounts-api";
import type { IRepo } from "./repo";
import type { CreateAccountRequest } from "@example/shared/accounts-api";
import type { GetAddressResponse } from "@example/shared/addresses-api";
import type { CreateAddressRequest } from "@example/shared/addresses-api";
import type { CreateAddressResponse } from "@example/shared/addresses-api";
import { ResourceNotFoundError } from "@example/shared/errors";

const TEST_PORT = 4444;

class TestRepo implements IRepo {
  private nextAccountId = 1;
  private nextAddressId = 1;
  accounts: Record<string, GetAccountResponse> = {};
  addresses: Record<string, GetAddressResponse> = {};

  async createAccount(account: CreateAccountRequest): Promise<CreateAccountResponse> {
    const id = this.nextAccountId.toString();
    this.nextAccountId++;

    this.accounts[id] = {
      id,
      name: account.name,
    };

    return { id };
  }

  async getAccount(id: string): Promise<GetAccountResponse> {
    const account = this.accounts[id];
    if (!account) {
      throw new ResourceNotFoundError(`Account(${id})`);
    }
    return account;
  }

  async createAddress(address: CreateAddressRequest): Promise<CreateAddressResponse> {
    const id = this.nextAddressId.toString();
    this.nextAddressId++;

    this.addresses[id] = {
      id,
      account_id: address.account_id,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
    };

    return { id };
  }

  async getAddress(id: string): Promise<GetAddressResponse> {
    const address = this.addresses[id];
    if (!address) {
      throw new ResourceNotFoundError(`Address(${id})`);
    }
    return address;
  }

  async getAccounts(): Promise<GetAccountResponse[]> {
    return Object.values(this.accounts);
  }

  reset(): void {
    this.nextAccountId = 1;
    this.nextAddressId = 1;
    this.accounts = {};
    this.addresses = {};
  }
}

describe("AccountsService", () => {
  const repo = new TestRepo();
  const service = new AccountsService(repo, TEST_PORT);

  beforeAll(async () => {
    await service.start();
  });

  afterAll(async () => {
    await service.stop();
  });

  beforeEach(() => {
    repo.reset();
  });

  test("create account returns new account id", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/accounts`, {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", name: "Test User" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as CreateAccountResponse;
    expect(body.id).toBe("1");
  });

  test("get account returns account details", async () => {
    // Create an account first
    const createResponse = await fetch(`http://localhost:${TEST_PORT}/accounts`, {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", name: "Test User" }),
    });
    const { id } = (await createResponse.json()) as CreateAccountResponse;

    // Get the account
    const getResponse = await fetch(`http://localhost:${TEST_PORT}/accounts/${id}`);
    expect(getResponse.status).toBe(200);
    const account = (await getResponse.json()) as GetAccountResponse;
    expect(account).toEqual({
      id,
      name: "Test User",
    });
  });

  test("get non-existent account returns 404", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/accounts/999`);
    expect(response.status).toBe(404);
  });

  test("create address returns new address id", async () => {
    // Create an account first
    const accountResponse = await fetch(`http://localhost:${TEST_PORT}/accounts`, {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", name: "Test User" }),
    });
    const { id: accountId } = (await accountResponse.json()) as CreateAccountResponse;

    // Create an address
    const addressResponse = await fetch(`http://localhost:${TEST_PORT}/addresses`, {
      method: "POST",
      body: JSON.stringify({
        account_id: parseInt(accountId),
        street_address: "123 Test St",
        city: "Test City",
        state: "TS",
        postal_code: "12345",
        country: "Test Country",
      }),
    });
    expect(addressResponse.status).toBe(200);
    const body = (await addressResponse.json()) as CreateAddressResponse;
    expect(body.id).toBe("1");
  });

  test("get address returns address details", async () => {
    // Create an account first
    const accountResponse = await fetch(`http://localhost:${TEST_PORT}/accounts`, {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", name: "Test User" }),
    });
    const { id: accountId } = (await accountResponse.json()) as CreateAccountResponse;

    // Create an address
    const createAddressResponse = await fetch(`http://localhost:${TEST_PORT}/addresses`, {
      method: "POST",
      body: JSON.stringify({
        account_id: parseInt(accountId),
        street_address: "123 Test St",
        city: "Test City",
        state: "TS",
        postal_code: "12345",
        country: "Test Country",
      }),
    });
    const { id: addressId } = (await createAddressResponse.json()) as CreateAddressResponse;

    // Get the address
    const getAddressResponse = await fetch(`http://localhost:${TEST_PORT}/addresses/${addressId}`);
    expect(getAddressResponse.status).toBe(200);
    const address = (await getAddressResponse.json()) as GetAddressResponse;
    expect(address).toEqual({
      id: addressId,
      account_id: parseInt(accountId),
      street_address: "123 Test St",
      city: "Test City",
      state: "TS",
      postal_code: "12345",
      country: "Test Country",
    });
  });

  test("get non-existent address returns 404", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/addresses/999`);
    expect(response.status).toBe(404);
  });
});
