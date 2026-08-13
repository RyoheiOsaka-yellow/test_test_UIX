-- Digital Dock v12 — authoritative state schema.
-- Append-only event log + per-branch head projection + immutable derived results.

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vessels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  semantic_id text NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, semantic_id)
);

CREATE TABLE branches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id         uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  name              text NOT NULL,
  head_version      bigint NOT NULL DEFAULT 0 CHECK (head_version >= 0),
  parent_branch_id  uuid REFERENCES branches(id),
  forked_at_version bigint,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vessel_id, name)
);

CREATE TABLE transactions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status                   text NOT NULL CHECK (status IN ('previewed', 'committed', 'reverted')),
  base_version             bigint NOT NULL CHECK (base_version >= 0),
  result_version           bigint,
  description              text NOT NULL DEFAULT '',
  operations               jsonb NOT NULL,
  revert_of_transaction_id uuid REFERENCES transactions(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  committed_at             timestamptz
);

CREATE INDEX transactions_branch_idx ON transactions (branch_id, created_at DESC);

-- Immutable, append-only event log. One event per operation, versioned per branch.
CREATE TABLE events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  version        bigint NOT NULL CHECK (version >= 1),
  seq            int NOT NULL CHECK (seq >= 0),
  type           text NOT NULL,
  payload        jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, version, seq)
);

CREATE INDEX events_branch_version_idx ON events (branch_id, version, seq);

CREATE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER events_immutable
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Head projection of each branch (rebuildable from events at any version).
CREATE TABLE entities (
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  semantic_id     text NOT NULL,
  kind            text NOT NULL,
  data            jsonb NOT NULL,
  created_version bigint NOT NULL,
  updated_version bigint NOT NULL,
  PRIMARY KEY (branch_id, semantic_id)
);

CREATE INDEX entities_kind_idx ON entities (branch_id, kind);

CREATE TABLE relations (
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  from_id         text NOT NULL,
  to_id           text NOT NULL,
  type            text NOT NULL,
  updated_version bigint NOT NULL,
  PRIMARY KEY (branch_id, from_id, to_id, type)
);

-- Immutable derived analysis results pinned to an exact branch version.
CREATE TABLE derived_results (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id  uuid NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  branch_id  uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  version    bigint NOT NULL CHECK (version >= 0),
  kind       text NOT NULL,
  input_hash text NOT NULL,
  result     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, version, kind, input_hash)
);

CREATE TRIGGER derived_results_immutable
  BEFORE UPDATE OR DELETE ON derived_results
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
