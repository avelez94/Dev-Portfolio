import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dqzjhtdqjcdimtsipqzl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxempodGRxamNkaW10c2lwcXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTIzMTUsImV4cCI6MjA5NjM2ODMxNX0.IJQBeTxG78MbpuaQCyNHjIGjH6X3agYZkmEwig4uKwk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
