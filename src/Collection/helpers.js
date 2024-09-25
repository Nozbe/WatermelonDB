import { sanitizedRaw } from "../RawRecord";

function buildAdjacencyList(relationships) {
  const adjacencyList = {};

  relationships.forEach(({ from, info, to, toTableAlias }) => {
    const { aliasFor } = info; // Extract alias from info
    if (!adjacencyList[from]) adjacencyList[from] = [];
    adjacencyList[from].push({ to, toTableAlias, ...info, alias: aliasFor || to }); // Use alias if provided, otherwise default to original table name
  });

  return adjacencyList;
}

function buildHierarchy(rootTable, results, adjacencyList, database) {
  const hierarchy = new Map(); // Use a Map for better performance
  const resultMap = new Map(); // Preprocess results for quick access
  const parentRelationMap = new Map(); // Keep track of parent relations to avoid duplicates

  // Preprocess results into a map
  results.forEach(row => {
    const tableName = Object.keys(adjacencyList).find(table => row[`${table}.id`]) || rootTable;
    const id = row[`${tableName}.id`];

    if (id) {
      resultMap.set(id, row);
    }
  });

  const buildTree = (item, tableName, visited, depth = 0) => {
    const relations = adjacencyList[tableName] || [];
  
    const itemId = item[`${tableName}.id`];
      
    if (visited.has(itemId)) {
      return; // Prevent revisiting the same item
    }
  
    visited.add(itemId); // Mark the item as visited
  
    relations.forEach(({ to, toTableAlias, key, foreignKey, type, alias }) => {
      const relatedItems = results
        .filter(data => {
          if (type === 'belongs_to') {
            return data[`${toTableAlias || alias || to}.id`] === item[`${tableName}.${key}`];
          } else {
            return data[`${toTableAlias || alias || to}.${foreignKey}`] === item[`${tableName}.id`];
          }
        })
        .map(data => {
          const relatedItemId = data[`${toTableAlias || alias || to}.id`];
          if (!relatedItemId) return null; // Skip invalid records
  
          let relatedItem = hierarchy.get(relatedItemId) || { ...data };
  
          // Ensure relatedItem is in the hierarchy
          if (!hierarchy.has(relatedItemId)) {
            hierarchy.set(relatedItemId, relatedItem);
          }
  
          return relatedItem;
        })
        .filter(item => item !== null); // Filter out null values
  
      if (relatedItems.length > 0) {
        // Group eager-loaded relations under 'expandedRelations'
        item.expandedRelations = item.expandedRelations || {};
        item.expandedRelations[to] = relatedItems;
  
        // Ensure we don't add duplicate related items
        const relationKey = `${toTableAlias || alias || to}.id`;
  
        if (!parentRelationMap.has(relationKey)) {
          item.expandedRelations[to] = relatedItems;
          parentRelationMap.set(relationKey, true);
        }
  
        relatedItems.forEach(relatedItem => {
          buildTree(relatedItem, toTableAlias || alias || to, visited, depth + 1);
        });
      }
    });  
  };
  
  // Initialize the hierarchy with the results
  resultMap.forEach((row, id) => {
    hierarchy.set(id, { ...row });
  });

  const visitedSet = new Set();
  
  // Start building the tree from the root table
  const rootData = Array.from(hierarchy.values()).filter(item => item[`${rootTable}.id`]);
  
  rootData.forEach(item => buildTree(item, rootTable, visitedSet));

  // Function to sanitize item
  const sanitizeItem = (item, tableName, alias, toTableAlias) => {
    const relatedTables = new Set(
      (adjacencyList[tableName] || []).map(({ to, alias, toTableAlias }) => ({ to, alias, toTableAlias }))
    );

    const collection = database.collections.get(alias || tableName);
    const ModelClass = collection.modelClass;
    const sanitized = sanitizedRaw(item, database.schema.tables[alias || tableName], true, toTableAlias);
    const sanitizedItem = new ModelClass(collection, sanitized);

    // Prepare a container for sanitized related items
    const sanitizedExpandedRelations = {};

    relatedTables.forEach(({ to: relatedTable, alias, toTableAlias }) => {
      const relatedItems = item.expandedRelations?.[relatedTable] || [];
      sanitizedExpandedRelations[relatedTable] = relatedItems.map(relatedItem =>
        sanitizeItem(relatedItem, relatedTable, alias, toTableAlias)
      );
    });

    // Assign sanitized related items back to the 'expandedRelations' property
    sanitizedItem.expandedRelations = sanitizedExpandedRelations;

    return sanitizedItem;
  };

  const sanitizedRootData = rootData.map(item => sanitizeItem(item, rootTable));

  return sanitizedRootData;
}

export function mapToGraph(results, relationships, collection) {
  const adjacencyList = buildAdjacencyList(relationships);
  const rootTable = collection.table;

  return buildHierarchy(rootTable, results, adjacencyList, collection.database);
}