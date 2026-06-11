/**
 * Add 'rejected' to the document_status enum for documents that fail the relevance check.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'rejected'");
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (_pgm) => {
  // Postgres does not support removing enum values; this migration is irreversible.
};
