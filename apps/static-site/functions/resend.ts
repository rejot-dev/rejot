const RESEND_API = "https://api.resend.com";
const DEFAULT_AUDIENCE_ID = "12f6866b-0c77-4647-9623-f0284d8c7cae";
const SENDER_IDENTITY = "cloudflare-worker@rejot.dev";

// https://resend.com/docs/api-reference/emails/send-email#body-parameters
type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  reply_to?: string;
  text?: string;
};

function sendEmail(payload: EmailPayload, apiKey: string): Promise<Response> {
  return fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

function sendContactFormEmail(
  name: string,
  email: string,
  message: string,
  apiKey: string,
): Promise<Response> {
  const emailPayload = {
    from: SENDER_IDENTITY,
    to: "founders@rejot.dev",
    reply_to: email,
    subject: `Contact form submitted by ${name}`,
    text: `New message from ${name} (${email}):\n${message}`,
  };
  return sendEmail(emailPayload, apiKey);
}

function sendNewsletterSignupEmail(email: string, apiKey: string): Promise<Response> {
  return sendEmail(
    {
      from: SENDER_IDENTITY,
      to: "founders@rejot.dev",
      subject: `New Newsletter Signup: ${email}`,
      text: ":^D",
    },
    apiKey,
  );
}
function addContactToDefaultAudience(email: string, apiKey: string): Promise<Response> {
  return fetch(`${RESEND_API}/audiences/${DEFAULT_AUDIENCE_ID}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email: email }),
  });
}

export { addContactToDefaultAudience, sendContactFormEmail, sendNewsletterSignupEmail };
