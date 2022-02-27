const dbFolderPath = process.cwd();

async function getDatabasePath(dbName) {
  let usedDbName = dbName;
  if (!usedDbName.endsWith('.db') && !usedDbName.includes('?')) {
    usedDbName = usedDbName.concat('.db');
  }

  let dbPath = dbName.includes(dbFolderPath) ? usedDbName : `${dbFolderPath}/${usedDbName}`;

  return dbPath;
}

export default getDatabasePath;
