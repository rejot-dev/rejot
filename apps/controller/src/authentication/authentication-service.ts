export interface IAuthenticationService {
  sendCode(email: string, code: string): Promise<void>;
  validateUser(email: string): Promise<{ code: string }>;
}

export class AuthenticationService implements IAuthenticationService {
  static inject = [] as const;

  sendCode(email: string, code: string): Promise<void> {
    // TODO: Implement actual email sending logic
    console.log("Sending code to", email, ":", code);
    return Promise.resolve();
  }

  validateUser(email: string): Promise<{ code: string }> {
    // TODO: Implement actual user validation/creation logic
    return Promise.resolve({
      code: email,
    });
  }
}
