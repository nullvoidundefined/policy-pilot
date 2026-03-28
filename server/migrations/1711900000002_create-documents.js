/**
 * Create documents table for tracking uploaded files and their processing status.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createType('document_status', [
    'uploaded',
    'chunking',
    'embedding',
    'ready',
    'failed',
  ]);

  pgm.createTable('documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    filename: { type: 'text', notNull: true },
    r2_key: { type: 'text', notNull: true },
    mime_type: { type: 'text', notNull: true },
    size_bytes: { type: 'integer', notNull: true },
    status: { type: 'document_status', notNull: true, default: 'uploaded' },
    total_chunks: { type: 'integer' },
    error: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('documents', 'user_id');
  pgm.createIndex('documents', 'status');
  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS set_updated_at ON documents;');
  pgm.dropTable('documents');
  pgm.dropType('document_status');
};
