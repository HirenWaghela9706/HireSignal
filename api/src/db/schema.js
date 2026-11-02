const { Pool } = require('pg');

const schema = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  apple_id VARCHAR(255),
  name VARCHAR(255),
  seniority_level VARCHAR(100),
  target_role VARCHAR(255),
  primary_skills TEXT[],
  personalisation_enabled BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analysed Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  company_name VARCHAR(255),
  role_title VARCHAR(255),
  platform VARCHAR(50),
  external_job_id VARCHAR(255),
  original_post_date DATE,
  last_repost_date DATE,
  repost_count INTEGER DEFAULT 0,
  days_open INTEGER,
  intent_score INTEGER,
  confidence_level VARCHAR(20),
  status VARCHAR(20) DEFAULT 'saved',
  ghost_risk_flag BOOLEAN DEFAULT false,
  signals JSONB,
  analysed_at TIMESTAMP DEFAULT NOW()
);
-- Migrations for existing tables
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS platform VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS external_job_id VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS language VARCHAR(10);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country VARCHAR(2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cache_hits INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_seen_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS platform_expiry_days INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_analyse BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scan_reset_date TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Prevent duplicate rows per user per job (same company+role+platform = same job)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_user_job_unique'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_user_job_unique
      UNIQUE (user_id, company_name, role_title, platform);
  END IF;
END $$;

-- Perplexity API usage log — one row per live (non-cached) call
CREATE TABLE IF NOT EXISTS perplexity_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255),
  called_at TIMESTAMP DEFAULT NOW()
);

-- Job-URL-level result cache — shared across all users.
-- Prevents re-running Perplexity + full scoring for the same job URL.
-- TTL: 30 days. force_rescan flag in the request bypasses this cache.
CREATE TABLE IF NOT EXISTS job_scans (
  id SERIAL PRIMARY KEY,
  job_url TEXT NOT NULL UNIQUE,
  job_url_normalized TEXT NOT NULL,
  company_name TEXT,
  job_title TEXT,
  score INTEGER,
  score_label TEXT,
  confidence TEXT,
  signals JSONB,
  perplexity_raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_scans_url ON job_scans(job_url_normalized);

-- Company Signals
CREATE TABLE IF NOT EXISTS company_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) UNIQUE,
  funding_event VARCHAR(255),
  funding_recency_days INTEGER,
  layoff_detected BOOLEAN DEFAULT false,
  headcount_trend VARCHAR(20),
  employee_sentiment DECIMAL(3,2),
  ghost_risk_label VARCHAR(10),
  last_updated TIMESTAMP DEFAULT NOW()
);
`;

async function initSchema(pool) {
  await pool.query(schema);
}

module.exports = { initSchema };
