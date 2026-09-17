-- Public dashboard access audit
-- Run this in Supabase SQL Editor before deploying the public access gate.

CREATE TABLE IF NOT EXISTS public_portal_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    visitor_id UUID NOT NULL,
    selected_contributor_type TEXT NOT NULL CHECK (selected_contributor_type IN ('building', 'individual')),
    selected_contributor_id UUID NOT NULL,
    selected_name TEXT NOT NULL,
    selected_unit TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_portal_access_logs_accessed_at
    ON public_portal_access_logs(accessed_at DESC);

ALTER TABLE public_portal_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert public portal access logs" ON public_portal_access_logs;
DROP POLICY IF EXISTS "Authenticated read public portal access logs" ON public_portal_access_logs;

CREATE POLICY "Public insert public portal access logs"
    ON public_portal_access_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Authenticated read public portal access logs"
    ON public_portal_access_logs FOR SELECT TO authenticated
    USING (true);
