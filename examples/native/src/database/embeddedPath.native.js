import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

async function getDatabasePath(dbName) {
  let usedDbName = dbName;

  const targetDbName = `${RNFS.DocumentDirectoryPath}/${usedDbName}`;
  const databaseExists = await RNFS.exists(targetDbName);
  if (!databaseExists) {
    if (Platform.OS === 'ios') {
      await RNFS.copyFile(`${RNFS.MainBundlePath}/${usedDbName}`, targetDbName);
    } else if (Platform.OS === 'android') {
      await RNFS.copyFileAssets(`${usedDbName}.db`, `${targetDbName}.db`);
    }
  }

  return targetDbName;
}

export default getDatabasePath;
