import staticFormsPlugin from "@cloudflare/pages-plugin-static-forms";
import type { PagesFunction } from "@cloudflare/workers-types";

import {
  addContactToDefaultAudience,
  sendContactFormEmail,
  sendNewsletterSignupEmail,
} from "./resend";
import { verifyRequest } from "./turnstile";

interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET: string;
}

async function handleContactFormSubmit(
  formData: FormData,
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> {
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;
  const submitterName = formData.get("name") as string;
  const token = formData.get("cf-turnstile-response") as string;
  const ip = context.request.headers.get("cf-connecting-ip") as string;
  const host = context.request.headers.get("host") as string;

  const verified = await verifyRequest(token, ip, context.env.TURNSTILE_SECRET);
  if (verified) {
    const response = await sendContactFormEmail(
      submitterName,
      email,
      message,
      context.env.RESEND_API_KEY,
    );
    if (response.ok) {
      return Response.redirect(`https://${host}/thank-you`, 302);
    }
  }
  return new Response("Oops your contact form failed to submit", {
    status: 500,
  });
}

async function handleNewsletterSubmit(
  formData: FormData,
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> {
  const email = formData.get("email") as string;
  const host = context.request.headers.get("host") as string;
  const token = formData.get("cf-turnstile-response") as string;
  const ip = context.request.headers.get("cf-connecting-ip") as string;
  const verified = await verifyRequest(token, ip, context.env.TURNSTILE_SECRET);

  if (!verified) {
    return new Response("Oops we could not verify you are a human", {
      status: 500,
    });
  }

  // Don't really care for the result
  const response = await addContactToDefaultAudience(email, context.env.RESEND_API_KEY);

  if (response.ok) {
    await sendNewsletterSignupEmail(email, context.env.RESEND_API_KEY);
    return Response.redirect(`https://${host}/thank-you`, 302);
  }

  return new Response("Oops we couldn't process your newsletter sign-up", { status: 500 });
}

export const onRequest: PagesFunction<Env> = async (context) =>
  staticFormsPlugin({
    respondWith: async ({ formData, name }) => {
      switch (name) {
        case "contact-form":
          return handleContactFormSubmit(formData, context);
        case "newsletter-form":
          return handleNewsletterSubmit(formData, context);
        default:
          return new Response("Unknown form submitted", { status: 400 });
      }
    },
  })(context);
