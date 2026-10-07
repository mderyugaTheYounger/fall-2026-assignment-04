import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. users table
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('email', 'varchar')
    .addColumn('name', 'varchar')
    .addColumn('created_at', 'timestamp')
    .execute();

  // 2. authors table
  await db.schema
    .createTable('authors')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar')
    .addColumn('bio', 'text')
    .execute();

  // 3. genres table
  await db.schema
    .createTable('genres')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar')
    .execute();

  // 4. books table
  await db.schema
    .createTable('books')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar')
    .addColumn('isbn', 'varchar')
    .addColumn('author_id', 'integer', (col) =>
      col.references('authors.id').onDelete('cascade')
    )
    .addColumn('genre_id', 'integer', (col) =>
      col.references('genres.id').onDelete('cascade')
    )
    .addColumn('created_at', 'timestamp')
    .execute();

  // 5. borrowers table (one-to-one with users via unique constraint on user_id)
  await db.schema
    .createTable('borrowers')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').unique()
    )
    .addColumn('phone', 'varchar')
    .addColumn('address', 'text')
    .execute();

  // 6. loans table
  await db.schema
    .createTable('loans')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('book_id', 'integer', (col) =>
      col.references('books.id').onDelete('cascade')
    )
    .addColumn('borrower_id', 'integer', (col) =>
      col.references('borrowers.id').onDelete('cascade')
    )
    .addColumn('loan_date', 'timestamp')
    .addColumn('due_date', 'timestamp')
    .addColumn('return_date', 'timestamp')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse dependency order
  await db.schema.dropTable('loans').ifExists().execute();
  await db.schema.dropTable('borrowers').ifExists().execute();
  await db.schema.dropTable('books').ifExists().execute();
  await db.schema.dropTable('genres').ifExists().execute();
  await db.schema.dropTable('authors').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
