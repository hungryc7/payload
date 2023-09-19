import type { SQL } from 'drizzle-orm'
import type { PgSelect } from 'drizzle-orm/pg-core'
import type { Find } from 'payload/database'
import type { PayloadRequest, SanitizedCollectionConfig, TypeWithID } from 'payload/types'

import { asc, desc, inArray, sql } from 'drizzle-orm'
import toSnakeCase from 'to-snake-case'

import type { GenericColumn, PostgresAdapter } from './types'

import { buildFindManyArgs } from './find/buildFindManyArgs'
import buildQuery from './queries/buildQuery'
import { transform } from './transform/read'

export const find: Find = async function find(
  this: PostgresAdapter,
  {
    collection,
    limit: limitArg,
    locale,
    page = 1,
    pagination,
    req = {} as PayloadRequest,
    sort: sortArg,
    where: whereArg,
  },
) {
  const collectionConfig: SanitizedCollectionConfig = this.payload.collections[collection].config
  const tableName = toSnakeCase(collection)
  const table = this.tables[tableName]
  const sort = typeof sortArg === 'string' ? sortArg : collectionConfig.defaultSort
  let limit = limitArg
  let totalDocs: number
  let totalPages: number
  let hasPrevPage: boolean
  let hasNextPage: boolean
  let pagingCounter: number
  let selectDistinctResult

  const { joins, orderBy, selectFields, where } = await buildQuery({
    adapter: this,
    fields: collectionConfig.fields,
    locale,
    sort,
    tableName,
    where: whereArg,
  })
  const db = this.sessions?.[req.transactionID] || this.db
  const orderedIDMap: Record<number | string, number> = {}
  let selectCount: PgSelect<string, { count: SQL<number> }, 'partial', Record<string, 'not-null'>>

  const methodsToCall: {
    args: unknown[]
    method: string
  }[] = []

  if (orderBy?.order && orderBy?.column) {
    methodsToCall.push({
      args: [orderBy.order(orderBy.column)],
      method: 'orderBy',
    })
  }

  const findManyArgs = buildFindManyArgs({
    adapter: this,
    depth: 0,
    fields: collectionConfig.fields,
    tableName,
  })

  // only fetch IDs when a sort or where query is used that needs to be done on join tables, otherwise these can be done directly on the table in findMany
  if (Object.keys(joins).length > 0) {
    if (where) {
      methodsToCall.push({ args: [where], method: 'where' })
    }
    Object.entries(joins).forEach(([joinTable, condition]) => {
      if (joinTable) {
        methodsToCall.push({
          args: [this.tables[joinTable], condition],
          method: 'leftJoin',
        })
      }
    })

    methodsToCall.push({ args: [(page - 1) * limit], method: 'offset' })
    methodsToCall.push({ args: [limit === 0 ? undefined : limit], method: 'limit' })

    selectDistinctResult = await methodsToCall.reduce((query, { args, method }) => {
      return query[method](...args)
    }, db.selectDistinct(selectFields).from(table))

    if (selectDistinctResult.length === 0) {
      return {
        docs: [],
        hasNextPage: false,
        hasPrevPage: false,
        limit,
        nextPage: null,
        page: 1,
        pagingCounter: 0,
        prevPage: null,
        totalDocs: 0,
        totalPages: 0,
      }
    }
    // set the id in an object for sorting later
    selectDistinctResult.forEach(({ id }, i) => {
      orderedIDMap[id as number | string] = i
    })
    findManyArgs.where = inArray(this.tables[tableName].id, Object.keys(orderedIDMap))
  } else {
    findManyArgs.limit = limitArg === 0 ? undefined : limitArg
    findManyArgs.offset = (page - 1) * limitArg
    if (where) {
      findManyArgs.where = where
    }
    findManyArgs.orderBy = orderBy.order(orderBy.column)
  }

  const findPromise = db.query[tableName].findMany(findManyArgs)

  if (pagination !== false || selectDistinctResult?.length > limit) {
    selectCount = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(where)
    Object.entries(joins).forEach(([joinTable, condition]) => {
      if (joinTable) {
        selectCount.leftJoin(this.tables[joinTable], condition)
      }
    })
    const countResult = await selectCount
    totalDocs = Number(countResult[0].count)
    totalPages = typeof limit === 'number' ? Math.ceil(totalDocs / limit) : 1
    hasPrevPage = page > 1
    hasNextPage = totalPages > page
    pagingCounter = (page - 1) * limit + 1
  }

  const rawDocs = await findPromise
  // sort rawDocs from selectQuery
  if (Object.keys(orderedIDMap).length > 0) {
    rawDocs.sort((a, b) => orderedIDMap[a.id] - orderedIDMap[b.id])
  }

  if (pagination === false) {
    totalDocs = rawDocs.length
    limit = totalDocs
    totalPages = 1
    pagingCounter = 1
    hasPrevPage = false
    hasNextPage = false
  }

  const docs = rawDocs.map((data: TypeWithID) => {
    return transform({
      config: this.payload.config,
      data,
      fields: collectionConfig.fields,
    })
  })

  return {
    docs,
    hasNextPage,
    hasPrevPage,
    limit,
    nextPage: hasNextPage ? page + 1 : null,
    page,
    pagingCounter,
    prevPage: hasPrevPage ? page - 1 : null,
    totalDocs,
    totalPages,
  }
}
