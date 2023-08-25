import fs from 'fs';
import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Connect } from 'payload/database';
import { Client, Pool } from 'pg';
import { generateDrizzleJson, pushSchema } from 'drizzle-kit/utils';
import { configToJSONSchema } from 'payload/utilities';
import prompts from 'prompts';

import { jsonb, numeric, pgTable, varchar } from 'drizzle-orm/pg-core';
import type { PostgresAdapter } from './types';
import { DrizzleDB, GenericEnum, GenericRelation, GenericTable } from './types';

// Migration table def in order to use query using drizzle
const migrationsSchema = pgTable('payload_migrations', {
  name: varchar('name'),
  batch: numeric('batch'),
  schema: jsonb('schema'),
});

export const connect: Connect = async function connect(
  this: PostgresAdapter,
  payload,
) {
  let db: DrizzleDB;

  this.schema = {
    ...this.tables,
    ...this.relations,
    ...this.enums,
  };

  try {
    if ('pool' in this && this.pool !== false) {
      const pool = new Pool(this.pool);
      db = drizzle(pool, { schema: this.schema });
      await pool.connect();
    }

    if ('client' in this && this.client !== false) {
      const client = new Client(this.client);
      db = drizzle(client, { schema: this.schema });
      await client.connect();
    }

    if (process.env.PAYLOAD_DROP_DATABASE === 'true') {
      this.payload.logger.info('---- DROPPING TABLES ----');
      await db.execute(sql`drop schema public cascade;\ncreate schema public;`);
      this.payload.logger.info('---- DROPPED TABLES ----');
    }
  } catch (err) {
    payload.logger.error(
      `Error: cannot connect to Postgres. Details: ${err.message}`,
      err,
    );
    process.exit(1);
  }

  this.payload.logger.info('Connected to Postgres successfully');
  this.db = db;

  // Only push schema if not in production
  if (process.env.NODE_ENV === 'production') return;

  // This will prompt if clarifications are needed for Drizzle to push new schema
  const { hasDataLoss, warnings, statementsToExecute, apply } = await pushSchema(this.schema, this.db);

  this.payload.logger.debug({
    msg: 'Schema push results',
    hasDataLoss,
    warnings,
    statementsToExecute,
  });

  if (warnings.length) {
    this.payload.logger.warn({
      msg: `Warnings detected during schema push: ${warnings.join('\n')}`,
      warnings,
    });

    if (hasDataLoss) {
      this.payload.logger.warn({
        msg: 'DATA LOSS WARNING: Possible data loss detected if schema is pushed.',
      });
    }

    const { confirm: acceptWarnings } = await prompts(
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Accept warnings and push schema to database?',
        initial: false,
      },
      {
        onCancel: () => {
          process.exit(0);
        },
      },
    );

    // Exit if user does not accept warnings.
    // Q: Is this the right type of exit for this interaction?
    if (!acceptWarnings) {
      process.exit(0);
    }
  }

  this.migrationDir = '.migrations';

  // Create drizzle snapshot if it doesn't exist
  if (!fs.existsSync(`${this.migrationDir}/drizzle-snapshot.json`)) {
    // Ensure migration dir exists
    if (!fs.existsSync(this.migrationDir)) {
      fs.mkdirSync(this.migrationDir);
    }

    const drizzleJSON = generateDrizzleJson(this.schema);

    fs.writeFileSync(`${this.migrationDir}/drizzle-snapshot.json`, JSON.stringify(drizzleJSON, null, 2));
  }

  const jsonSchema = configToJSONSchema(this.payload.config);

  await apply();

  const devPush = await this.db
    .select()
    .from(migrationsSchema)
    .where(eq(migrationsSchema.batch, '-1'));

  if (!devPush.length) {
    await this.db.insert(migrationsSchema).values({
      name: 'dev',
      batch: '-1',
      schema: JSON.stringify(jsonSchema),
    });
  } else {
    await this.db
      .update(migrationsSchema)
      .set({
        schema: JSON.stringify(jsonSchema),
      })
      .where(eq(migrationsSchema.batch, '-1'));
  }
};
