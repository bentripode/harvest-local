-- Enable PostGIS before any schema migration references geography / geometry types.
--
-- This must run first: 20260901221900_phase1_schema.sql declares a `geography(Point,4326)` column
-- and a GiST index over it. Without the extension present the CREATE TABLE fails with
-- `type "geography" does not exist`.
--
-- On hosted Supabase the `extensions` schema already exists and is the sanctioned home for
-- extension objects — never install PostGIS into `public`. The local stack (`supabase db reset`)
-- resolves this identically, so dev and prod stay in parity.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
