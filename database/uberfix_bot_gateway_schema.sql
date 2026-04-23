-- UberFix / Bot Gateway direct PostgreSQL schema
-- Idempotent: safe to run more than once.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS api_consumers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    channel text NOT NULL DEFAULT 'api',
    api_key text UNIQUE,
    api_key_hash text,
    api_key_last4 text,
    is_active boolean NOT NULL DEFAULT true,
    rate_limit_per_minute integer NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0),
    allowed_origins text[] NOT NULL DEFAULT ARRAY[]::text[],
    company_id uuid,
    branch_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_gateway_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id uuid REFERENCES api_consumers(id) ON DELETE SET NULL,
    route text NOT NULL,
    action text,
    request_payload jsonb,
    response_payload jsonb,
    status_code integer,
    success boolean,
    duration_ms integer,
    ip_address inet,
    user_agent text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type text NOT NULL DEFAULT 'bot',
    actor_id text,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text NOT NULL UNIQUE,
    client_phone text,
    client_name text,
    client_email text,
    location text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    preferred_branch_id uuid,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    address text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    phone text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    label_ar text NOT NULL,
    label_en text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS maintenance_request_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_maintenance_request_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    next_num bigint;
    yy text;
BEGIN
    next_num := nextval('maintenance_request_number_seq');
    yy := to_char(now(), 'YY');
    RETURN 'MR-' || yy || '-' || lpad(next_num::text, 5, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number text NOT NULL UNIQUE DEFAULT next_maintenance_request_number(),
    channel text NOT NULL DEFAULT 'bot_gateway',
    session_id text,
    client_name text NOT NULL,
    client_phone text NOT NULL,
    client_email text,
    location text,
    service_type text NOT NULL DEFAULT 'general',
    title text,
    description text NOT NULL,
    priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'normal', 'high')),
    status text NOT NULL DEFAULT 'submitted',
    workflow_stage text NOT NULL DEFAULT 'submitted' CHECK (workflow_stage IN ('submitted', 'acknowledged', 'on_hold', 'cancelled', 'scheduled', 'in_progress', 'completed', 'billed', 'paid', 'closed')),
    customer_notes text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    assigned_technician_id uuid,
    technician_name text,
    eta timestamptz,
    scheduled_at timestamptz,
    track_url text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_request_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    note text NOT NULL,
    note_type text NOT NULL DEFAULT 'customer',
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_technicians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text,
    specialization text,
    city_id uuid,
    rating numeric(3,2) DEFAULT 0,
    review_count integer NOT NULL DEFAULT 0,
    tier text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    is_active boolean NOT NULL DEFAULT true,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES maintenance_requests(id) ON DELETE SET NULL,
    channel text NOT NULL DEFAULT 'whatsapp',
    recipient text NOT NULL,
    message text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    provider_response jsonb,
    error_message text,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['api_consumers','bot_sessions','branches','maintenance_categories','maintenance_requests','maintenance_technicians'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl, tbl);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_consumer_created ON api_gateway_logs(consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_gateway_logs_action_created ON api_gateway_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_phone ON bot_sessions(client_phone);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_expires ON bot_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_number ON maintenance_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_phone ON maintenance_requests(client_phone);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status, workflow_stage);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created ON maintenance_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_status ON outbound_messages(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_technicians_specialization ON maintenance_technicians(specialization, is_active, is_verified);

INSERT INTO maintenance_categories (key, label_ar, label_en, sort_order)
VALUES
    ('plumbing', 'سباكة', 'Plumbing', 10),
    ('electrical', 'كهرباء', 'Electrical', 20),
    ('ac', 'تكييف', 'AC', 30),
    ('painting', 'دهانات', 'Painting', 40),
    ('carpentry', 'نجارة', 'Carpentry', 50),
    ('cleaning', 'تنظيف', 'Cleaning', 60),
    ('general', 'صيانة عامة', 'General Maintenance', 70),
    ('appliance', 'أجهزة منزلية', 'Appliance', 80),
    ('pest_control', 'مكافحة حشرات', 'Pest Control', 90),
    ('landscaping', 'حدائق وتنسيق', 'Landscaping', 100),
    ('finishing', 'تشطيبات', 'Finishing', 110),
    ('renovation', 'ترميم', 'Renovation', 120)
ON CONFLICT (key) DO UPDATE SET
    label_ar = EXCLUDED.label_ar,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

COMMIT;
