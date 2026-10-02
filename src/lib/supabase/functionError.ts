import { FunctionsHttpError } from "@supabase/supabase-js";

// supabase.functions.invoke() returns data=null on a non-2xx response and
// only a generic "non-2xx status code" message; the function's own error
// text lives in the response body on error.context.
export async function functionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.error) return String(body.error);
    } catch {
      // body wasn't JSON — fall through
    }
  }
  return (err as Error | null)?.message ?? fallback;
}
