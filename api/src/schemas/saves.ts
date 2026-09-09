import { z } from "zod";

// Length caps matter beyond "don't store megabytes per row" — title/
// description eventually get interpolated into WhatsApp template
// parameters (whatsapp/service.ts), which have their own (much smaller,
// Meta-enforced) limits. Capping generously here still catches the
// pathological cases (a multi-MB string) without needing to match Meta's
// exact limits — Meta's own API call still fails safely on genuine
// overflow, this just stops obviously-abusive payloads earlier.
export const saveBodySchema = z.object({
  partnerApiKey: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().max(2000).optional(),
});

export type SaveBody = z.infer<typeof saveBodySchema>;
