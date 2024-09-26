import { sanitizedRaw } from "../RawRecord";

function buildAdjacencyList(relationships) {
  const adjacencyList = {};

  relationships.forEach(({ from, info, to, joinedAs }) => {
    const { aliasFor } = info; // Extract alias from info
    if (!adjacencyList[from]) adjacencyList[from] = [];
    adjacencyList[from].push({ to, joinedAs, ...info, alias: aliasFor }); // Use alias if provided, otherwise default to original table name
  });

  return adjacencyList;
}

function buildHierarchy(rootTable, results, adjacencyList, database) {
  const hierarchy = new Map(); // Use a Map for better performance
  const resultMap = new Map(); // Preprocess results for quick access
  const parentRelationMap = new Map(); // Keep track of parent relations to avoid duplicates
  const lookupMaps = {}; // Lookup maps for eager loading relations

  // Build lookup maps for each relationship
  Object.keys(adjacencyList).forEach(tableName => {
    const relations = adjacencyList[tableName];

    relations.forEach(({ to, foreignKey, type, key, alias, joinedAs }) => {
      const actualTo = joinedAs || alias || to; // Determine the actual table to reference
      const mapKey = `${tableName}-${actualTo}`; // Construct mapKey using actual table name

      if (!lookupMaps[mapKey]) lookupMaps[mapKey] = new Map();

      results.forEach(row => {
        let parentId = null;
        let hasRelation = false;

        if (type === 'belongs_to') {
          const parentKeyValue = row[`${tableName}.${key}`]
          const childId = row[`${actualTo}.id`];

          if (parentKeyValue && childId) {
            parentId = row[`${tableName}.id`];
            hasRelation = true;
          }
        } else if (type === 'has_many') {
          parentId = row[`${tableName}.id`];
          const foreignKeyValue = row[`${actualTo}.${foreignKey}`];

          if (foreignKeyValue && parentId) {
            hasRelation = true;
          }
        }

        if (hasRelation && parentId) {
          // Initialize the array for the parentKey if it doesn't exist
          if (!lookupMaps[mapKey][parentId]) {
            lookupMaps[mapKey][parentId] = []; // Create an array for this parentKey
          }

          lookupMaps[mapKey][parentId].push(row); // Push the row into the array for this parentKey
        }
      });
    });
  });

  // Preprocess results into a map
  results.forEach(row => {
    const tableName = Object.keys(adjacencyList).find(table => row[`${table}.id`]) || rootTable;
    const id = row[`${tableName}.id`];

    if (id) {
      resultMap.set(id, row);
    }
  });

  const buildTree = (item, table) => {
    const relationQueue = [{
      table,
      row: item
    }]

    while (relationQueue.length > 0) {
      const { table, row } = relationQueue.shift();
      const relations = adjacencyList[table] || [];

      relations.forEach(({ joinedAs, alias, to }) => {
        const actualTo = joinedAs || alias || to;
        const relatedItems = lookupMaps[`${table}-${actualTo}`]?.[row[`${table}.id`]] || [];

        if (relatedItems.length > 0) {
          // Ensure we don't add duplicate related items
          const parentChildRelationKey = `${row[`${table}.id`]}-${actualTo}`;

          if (!parentRelationMap.has(parentChildRelationKey)) {
            // Group eager-loaded relations under 'expandedRelations'
            row.expandedRelations = row.expandedRelations || {};
            row.expandedRelations[to] = relatedItems;

            parentRelationMap.set(parentChildRelationKey, true);

            relatedItems.forEach(relatedItem => {
              relationQueue.push({
                table: actualTo,
                row: relatedItem
              });
            });
          }
        }
      })
    }

    return item;
  }

  // Initialize the hierarchy with the results
  resultMap.forEach((row, id) => {
    hierarchy.set(id, { ...row });
  });

  // Start building the tree from the root table
  const rootData = Array.from(hierarchy.values()).filter(item => item[`${rootTable}.id`]);

  rootData.forEach(item => buildTree(item, rootTable));

  // Function to sanitize item
  const sanitizeItem = (item, tableName, alias, joinedAs, visited = new Set()) => {
    // Check for cycles
    const itemId = item[`${joinedAs || alias || tableName}.id`];

    if (visited.has(itemId)) {
      return null; // Cycle detected, skip this item
    }

    // Mark this item as visited
    visited.add(itemId);

    const relatedTables = new Set(
      (adjacencyList[tableName] || []).map(({ to, alias, joinedAs }) => ({ to, alias, joinedAs }))
    );

    const collection = database.collections.get(alias || tableName);
    const ModelClass = collection.modelClass;
    const sanitized = sanitizedRaw(item, database.schema.tables[alias || tableName], true, joinedAs);
    const sanitizedItem = new ModelClass(collection, sanitized);

    // Prepare a container for sanitized related items
    const sanitizedExpandedRelations = {};

    relatedTables.forEach(({ to: relatedTable, alias, joinedAs }) => {
      const relatedItems = item.expandedRelations?.[relatedTable] || [];
      sanitizedExpandedRelations[relatedTable] = relatedItems.map(relatedItem =>
        sanitizeItem(relatedItem, relatedTable, alias, joinedAs, visited) // Pass visited set to the recursive call
      ).filter(Boolean); // Filter out null values (skipped items)
    });

    // Assign sanitized related items back to the 'expandedRelations' property
    sanitizedItem.expandedRelations = sanitizedExpandedRelations;

    return sanitizedItem;
  };

  const visitedSanitizedSet = new Set();

  return rootData
    .map(item => sanitizeItem(item, rootTable, undefined, undefined, visitedSanitizedSet));
}

export function mapToGraph(results, relationships, collection) {
  const adjacencyList = buildAdjacencyList(relationships);
  const rootTable = collection.table;

  return buildHierarchy(rootTable, results, adjacencyList, collection.database);
}