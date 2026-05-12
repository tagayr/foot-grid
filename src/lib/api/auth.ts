import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.server";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return { error: "Missing bearer token.", user: null };
  }

  const { anonKey, url } = getSupabaseBrowserConfig();
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: error?.message ?? "Invalid bearer token.", user: null };
  }

  return { error: null, user: data.user };
}

export function getAdminClient() {
  return createSupabaseAdminClient();
}
