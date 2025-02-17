import { tokens } from "typed-inject";
import { generateCode } from "@/codes/codes.ts";
import type { IClerkRepository } from "./clerk-repository.ts";
import type { IClerkApiClient } from "./clerk.api-client.ts";
import { ClerkError, ClerkErrors } from "@/clerk/clerk.error.ts";

export type Person = {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
};

export interface IClerkPersonService {
  retrieveOrCreateClerkPerson(clerkUserId: string): Promise<Person>;
  retrieveClerkPerson(clerkUserId: string): Promise<Person | null>;
}

export class ClerkPersonService implements IClerkPersonService {
  static inject = tokens("clerkRepository", "clerkApiClient");

  #clerkRepository: IClerkRepository;
  #clerkApiClient: IClerkApiClient;

  constructor(clerkRepository: IClerkRepository, clerkApiClient: IClerkApiClient) {
    this.#clerkRepository = clerkRepository;
    this.#clerkApiClient = clerkApiClient;
  }

  async retrieveClerkPerson(clerkUserId: string): Promise<Person | null> {
    return await this.#clerkRepository.getPersonByClerkUserId(clerkUserId);
  }

  async retrieveOrCreateClerkPerson(clerkUserId: string): Promise<Person> {
    const person = await this.#clerkRepository.getPersonByClerkUserId(clerkUserId);

    if (person) {
      return person;
    }

    const { firstName, lastName, email } = await this.#clerkApiClient.getUser(clerkUserId);

    await this.#clerkRepository.insertPersonAndClerkUser({
      clerkUserId,
      person: {
        code: generateCode("PERS"),
        firstName,
        lastName,
        email,
      },
    });

    const personAfterInsert = await this.#clerkRepository.getPersonByClerkUserId(clerkUserId);

    if (!personAfterInsert) {
      throw new ClerkError(ClerkErrors.INSERTION_FAILED).withContext({
        clerkUserId,
      });
    }

    return {
      code: personAfterInsert.code,
      firstName: personAfterInsert.firstName,
      lastName: personAfterInsert.lastName,
      email: personAfterInsert.email,
    };
  }
}
