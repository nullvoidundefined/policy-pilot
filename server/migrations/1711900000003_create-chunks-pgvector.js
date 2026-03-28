/**
 * Enable pgvector extension and create chunks table with vector embeddings.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS vector;');

  pgm.createTable('chunks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    document_id: {
      type: 'uuid',
      notNull: true,
      references: 'documents',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    chunk_index: { type: 'integer', notNull: true },
    content: { type: 'text', notNull: true },
    token_count: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  // Add embedding column (1536 dims for OpenAI text-embedding-3-small)
  pgm.sql('ALTER TABLE chunks ADD COLUMN embedding vector(1536);');

  pgm.createIndex('chunks', 'document_id');
  pgm.createIndex('chunks', 'user_id');
  pgm.createIndex('chunks', ['document_id', 'chunk_index'], { unique: true });

  // HNSW index for fast approximate nearest neighbor search
  pgm.sql(`
    CREATE INDEX chunks_embedding_idx ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('chunks');
  pgm.sql('DROP EXTENSION IF EXISTS vector;');
};
