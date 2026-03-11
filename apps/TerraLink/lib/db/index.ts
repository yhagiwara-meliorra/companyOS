/**
 * Database utilities.
 * Supabase SQL migrations are the single source of truth for the schema.
 * No ORM (Prisma, Drizzle, etc.) is used as the schema authority.
 */
export { createClient } from "@/lib/auth/supabase-server";
