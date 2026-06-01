/**
 * Create collections table and add collection_id to documents.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable('collections', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    is_demo: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  pgm.createIndex('collections', 'user_id');

  pgm.addColumn('documents', {
    collection_id: {
      type: 'uuid',
      references: 'collections',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('documents', 'collection_id');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropColumn('documents', 'collection_id');
  pgm.dropTable('collections');
};
