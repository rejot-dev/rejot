import type { IAuthenticationService } from "@/authentication/authentication-service.ts";
import { Hono } from "hono";
export class AuthenticationRoutes {
  static inject = ["authenticationService"] as const;

  #routes;

  constructor(_authenticationService: IAuthenticationService) {
    this.#routes = new Hono();
  }

  get routes() {
    return this.#routes;
  }
}
