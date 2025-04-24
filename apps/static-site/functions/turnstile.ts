export async function verifyRequest(token: string, ip: string, secret: string): Promise<boolean> {
  const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  const result = await fetch(url, {
    body: JSON.stringify({
      secret: secret,
      response: token,
      remoteip: ip,
    }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const outcome = await result.json();
  return outcome.success;
}
