import { createClient } from "npm:@supabase/supabase-js@2";
import { handleNotify } from "./handler.ts";

Deno.serve((req) => handleNotify(req, { env: (n) => Deno.env.get(n), fetch, createClient }));
