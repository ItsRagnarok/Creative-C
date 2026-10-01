import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// One client per browser tab, reused by every component — createClient()
// used to be called fresh on every render in 12+ client components, each
// call spinning up its own GoTrueClient (storage reads, auth listener,
// refresh timer) for no reason, since a single instance already handles
// every table/auth call the whole app needs.
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
