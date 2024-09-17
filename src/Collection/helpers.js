import { sanitizedRaw } from "../RawRecord"

function buildAdjacencyList(relationships) {
  const adjacencyList = {}

  relationships.forEach(({ from, info, to }) => {
    if (!adjacencyList[from]) adjacencyList[from] = []
    adjacencyList[from].push({ to, ...info })
  })

  return adjacencyList
}

function buildHierarchy(rootTable, results, adjacencyList, database) {
  const hierarchy = {} // Map of id to data

  // Function to recursively build the tree
  const buildTree = (item, tableName) => {
    const relations = adjacencyList[tableName] || []

    relations.forEach(({ to, key, foreignKey, type }) => {
      const linkKey = type === 'belongs_to' ? key : foreignKey
      const relatedItems = results
        .filter((data) => data[linkKey] === item.id)
        .map((data) => {
          const relatedItemId = data[`${to}.id`]
          if (!relatedItemId) return null // Skip invalid records

          let relatedItem = hierarchy[relatedItemId] || { ...data }

          // Ensure relatedItem is in the hierarchy
          if (!hierarchy[relatedItemId]) {
            hierarchy[relatedItemId] = relatedItem
          }

          return relatedItem
        })
        .filter((item) => item !== null) // Filter out null values

      if (relatedItems.length > 0) {
        item[to] = relatedItems
        relatedItems.forEach((relatedItem) => buildTree(relatedItem, to))
      }
    })
  }

  // Initialize the hierarchy with the results
  results.forEach((row) => {
    const tableName =
      Object.keys(adjacencyList).find((table) => row[`${table}.id`]) ||
      rootTable
    const id = row[`${tableName}.id`]

    if (id) {
      hierarchy[id] = hierarchy[id] || { ...row }
    }
  })

  // Start building the tree from the root table
  const rootData = Object.values(hierarchy).filter(
    (item) => item[`${rootTable}.id`]
  )

  rootData.forEach((item) => buildTree(item, rootTable))

  // Function to sanitize item
  const sanitizeItem = (item, tableName) => {
    const relatedTables = new Set(
      (adjacencyList[tableName] || []).map(({ to }) => to)
    )

    const collection = database.collections.get(tableName)
    const ModelClass = collection.modelClass
    const sanitized = sanitizedRaw(item, database.schema.tables[tableName], true)
    const sanitizedItem = new ModelClass(collection, sanitized)

    relatedTables.forEach((relatedTable) => {
      const relatedItems = item[relatedTable] || []
      sanitizedItem[relatedTable] = relatedItems.map((relatedItem) =>
        sanitizeItem(relatedItem, relatedTable)
      )
    })

    return sanitizedItem
  }

  const sanitizedRootData = rootData.map((item) =>
    sanitizeItem(item, rootTable)
  )

  return sanitizedRootData
}

export function mapToGraph(results, relationships, collection) {
  const adjacencyList = buildAdjacencyList(relationships)
  const rootTable = collection.table

  return buildHierarchy(rootTable, results, adjacencyList, collection.database)
}