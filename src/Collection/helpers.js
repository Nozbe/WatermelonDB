import { sanitizedRaw } from "../RawRecord"
function buildAdjacencyList(relationships) {
  const adjacencyList = {}

  relationships.forEach(({ from, info, to }) => {
    const { alias } = info // Extract alias from info
    if (!adjacencyList[from]) adjacencyList[from] = []
    adjacencyList[from].push({ to, ...info, alias: alias || to }) // Use alias if provided, otherwise default to original table name
  })

  return adjacencyList
}

function buildHierarchy(rootTable, results, adjacencyList, database) {
  const hierarchy = {} // Map of id to data

  // Function to recursively build the tree
  const buildTree = (item, tableName) => {
    const relations = adjacencyList[tableName] || []

    relations.forEach(({ to, key, foreignKey, type, alias }) => {
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
        // Group eager-loaded relations under 'expandedRelations'
        item.expandedRelations = item.expandedRelations || {}
        item.expandedRelations[alias || to] = relatedItems
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

    // Prepare a container for sanitized related items
    const sanitizedExpandedRelations = {}

    relatedTables.forEach((relatedTable) => {
      const relatedItems = item.expandedRelations?.[relatedTable] || [];
      sanitizedExpandedRelations[relatedTable] = relatedItems.map((relatedItem) =>
        sanitizeItem(relatedItem, relatedTable)
      );
    });

    // Assign sanitized related items back to the 'expandedRelations' property
    sanitizedItem.expandedRelations = sanitizedExpandedRelations;

    return sanitizedItem
  }

  const sanitizedRootData = rootData.map((item) =>
    sanitizeItem(item, rootTable)
  )

  return sanitizedRootData
}

export function mapToGraph(results, relationships, collection) {
  const adjacencyList = buildAdjacencyList(relationships);
  const rootTable = collection.table;

  return buildHierarchy(rootTable, results, adjacencyList, collection.database);
}