-- ============================================================
-- ELITEOS DATABASE SCHEMA
-- Run this in Supabase SQL Editor (once)
-- ============================================================

-- Training Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Run','Strength','Bike','Swim','Rest','Other')),
  title TEXT NOT NULL,
  duration_min INTEGER,
  distance_km NUMERIC(6,2),
  notes TEXT,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','planned','skipped')),
  source TEXT DEFAULT 'claude', -- 'claude' | 'garmin' | 'manual'
  garmin_activity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Recovery Snapshots
CREATE TABLE IF NOT EXISTS recovery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  hrv_ms NUMERIC(6,1),
  sleep_hrs NUMERIC(4,2),
  sleep_score INTEGER,
  readiness_score INTEGER,
  rhr_bpm INTEGER,
  strain_score NUMERIC(4,2),
  recovery_score INTEGER,
  notes TEXT,
  adjustments JSONB DEFAULT '[]',
  alert_level TEXT DEFAULT 'INFO' CHECK (alert_level IN ('INFO','ADVISORY','WARNING','CRITICAL')),
  source TEXT DEFAULT 'claude',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Intelligence Log (every Claude action tracked)
CREATE TABLE IF NOT EXISTS intel_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  category TEXT NOT NULL, -- 'session_logged' | 'recovery_updated' | 'intervention' | 'pattern' | 'analysis'
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT DEFAULT 'INFO',
  data JSONB,
  dismissed BOOLEAN DEFAULT FALSE
);

-- Athlete Profile & System State
CREATE TABLE IF NOT EXISTS athlete_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT DEFAULT 'Athlete',
  system_mode TEXT DEFAULT 'Normal' CHECK (system_mode IN ('Normal','Locked-In','Recovery','Race','Rebuild')),
  current_phase TEXT DEFAULT 'Base Build',
  weekly_mileage_target_km NUMERIC(5,1) DEFAULT 50,
  race_goal TEXT,
  race_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather Cache (Mumbai, auto-refreshed)
CREATE TABLE IF NOT EXISTS weather_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  date DATE NOT NULL,
  temp_c NUMERIC(4,1),
  humidity_pct INTEGER,
  heat_index NUMERIC(4,1),
  condition TEXT,
  feels_like_c NUMERIC(4,1),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default athlete profile
INSERT INTO athlete_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (open for now — add auth later)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;

-- Allow all operations (anon key) — secure after adding auth
CREATE POLICY "Allow all" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON recovery FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON intel_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON athlete_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weather_cache FOR ALL USING (true) WITH CHECK (true);
