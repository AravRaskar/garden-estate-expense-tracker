-- Public dashboard interaction audit. Apply before deploying the updated portal.
CREATE TABLE IF NOT EXISTS public_portal_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    visitor_id UUID NOT NULL,
    access_log_id UUID REFERENCES public_portal_access_logs(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'resident_picker_open', 'resident_picker_search', 'resident_selected',
        'consent_changed', 'dashboard_opened', 'donor_picker_open',
        'donor_picker_search', 'receipt_opened', 'expense_search',
        'expense_category_opened', 'expense_category_closed',
        'contributor_search', 'timetable_opened', 'theme_changed'
    )),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_portal_events_occurred_at
    ON public_portal_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_portal_events_access_log_id
    ON public_portal_events (access_log_id);

ALTER TABLE public_portal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert public portal events" ON public_portal_events;
DROP POLICY IF EXISTS "Authenticated read public portal events" ON public_portal_events;

CREATE POLICY "Public insert public portal events"
    ON public_portal_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated read public portal events"
    ON public_portal_events FOR SELECT TO authenticated USING (true);
