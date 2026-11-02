import { z } from "zod";

// Bare hostname only (no scheme/path/port) — matches the shape
// domain-check.ts's isUrlAllowedForPartner expects and normalizes.
// Deliberately permissive on structure (no full FQDN regex) since a
// malformed entry just fails to match any real saved URL later — it's a
// safe default-closed failure, not a security hole, so it isn't worth a
// stricter pattern that risks rejecting a legitimate but unusual domain.
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .refine((d) => !d.includes("/") && !d.includes(" "), "must be a bare hostname, e.g. example.com");

export const createPartnerBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  brandName: z.string().trim().max(200).optional(),
  // New accounts start disabled; domain proof is set up after creation.
  allowedDomains: z.array(domainSchema).max(20).optional(),
});

export type CreatePartnerBody = z.infer<typeof createPartnerBodySchema>;

export const updateAllowedDomainsBodySchema = z.object({
  allowedDomains: z.array(domainSchema).max(20),
});

export type UpdateAllowedDomainsBody = z.infer<typeof updateAllowedDomainsBodySchema>;

export const createInviteBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
