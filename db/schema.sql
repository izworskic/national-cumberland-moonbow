CREATE TABLE IF NOT EXISTS moonbow_outcomes (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timestamp TIMESTAMPTZ NOT NULL,
  target_date DATE NOT NULL,
  viewpoint TEXT NOT NULL,
  moonbow_visible BOOLEAN NOT NULL,
  visibility_strength SMALLINT NOT NULL CHECK (visibility_strength BETWEEN 0 AND 3),
  moon_illumination DOUBLE PRECISION,
  moon_altitude DOUBLE PRECISION,
  moon_azimuth DOUBLE PRECISION,
  sun_altitude DOUBLE PRECISION,
  flow_cfs DOUBLE PRECISION,
  flow_percentile DOUBLE PRECISION,
  cloud_forecast DOUBLE PRECISION,
  satellite_cloud_state TEXT,
  visibility_m DOUBLE PRECISION,
  precipitation_probability DOUBLE PRECISION,
  wind_speed_mps DOUBLE PRECISION,
  wind_direction DOUBLE PRECISION,
  model_score DOUBLE PRECISION NOT NULL,
  model_confidence DOUBLE PRECISION NOT NULL,
  observer_source TEXT NOT NULL,
  anonymous_reporter_hash TEXT NOT NULL,
  modeled_conditions JSONB NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'unverified',
  calibration_weight DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  user_agent_family TEXT
);

CREATE INDEX IF NOT EXISTS moonbow_outcomes_time_idx ON moonbow_outcomes (timestamp DESC);
CREATE INDEX IF NOT EXISTS moonbow_outcomes_target_idx ON moonbow_outcomes (target_date, viewpoint);
CREATE INDEX IF NOT EXISTS moonbow_outcomes_abuse_idx ON moonbow_outcomes (anonymous_reporter_hash, created_at DESC);
