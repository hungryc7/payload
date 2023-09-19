// type GenerateMigration = (before: DrizzleSnapshotJSON, after: DrizzleSnapshotJSON) => string[]

// type GenerateDrizzleJSON = (schema: DrizzleSchemaExports) => DrizzleSnapshotJSON

// type PushDiff = (schema: DrizzleSchemaExports) => Promise<{ warnings: string[], apply: () => Promise<void> }>

// drizzle-kit@utils

import { generateDrizzleJson, generateMigration, pushSchema } from 'drizzle-kit/utils'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

async function generateUsage() {
  // @ts-expect-error Just TypeScript being broken // TODO: Open TypeScript issue
  const schema = await import('./data/users')
  // @ts-expect-error Just TypeScript being broken // TODO: Open TypeScript issue
  const schemaAfter = await import('./data/users-after')

  const drizzleJsonBefore = generateDrizzleJson(schema)
  const drizzleJsonAfter = generateDrizzleJson(schemaAfter)

  const sqlStatements = await generateMigration(drizzleJsonBefore, drizzleJsonAfter)

  console.log(sqlStatements)
}

async function pushUsage() {
  // @ts-expect-error Just TypeScript being broken // TODO: Open TypeScript issue
  const schemaAfter = await import('./data/users-after')

  const db = drizzle(new Pool({ connectionString: '' }))

  const response = await pushSchema(schemaAfter, db)

  console.log('\n')
  console.log('hasDataLoss: ', response.hasDataLoss)
  console.log('warnings: ', response.warnings)
  console.log('statements: ', response.statementsToExecute)

  await response.apply()

  process.exit(0)
}
