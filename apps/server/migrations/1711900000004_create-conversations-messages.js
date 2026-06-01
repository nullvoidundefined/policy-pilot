/**
 * Create conversations and messages tables for Q&A thread persistence.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('conversations', {
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
    title: {
      type: 'text',
      notNull: true,
      default: pgm.func("'New conversation'"),
    },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('conversations', 'user_id');
  pgm.sql(`
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  pgm.createTable('messages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    conversation_id: {
      type: 'uuid',
      notNull: true,
      references: 'conversations',
      onDelete: 'CASCADE',
    },
    role: { type: 'text', notNull: true },
    content: { type: 'text', notNull: true },
    cited_chunk_ids: { type: 'uuid[]', default: pgm.func("'{}'") },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('messages', 'conversation_id');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('messages');
  pgm.sql('DROP TRIGGER IF EXISTS set_updated_at ON conversations;');
  pgm.dropTable('conversations');
};
