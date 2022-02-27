/* this script needs @babel/node to run, check package.json script session */
import * as fs from 'fs';
import databasePromise from '../src/database/embeddedInit';

import { generate100 } from '../src/model/generate';

const dbName = 'WatermelonDemo.db';

async function generateEmbeddableDatabase() {
  if (fs.existsSync(dbName)) {
    fs.unlinkSync(dbName);
  }
  const database = await databasePromise;

  await generate100(database);

  fs.copyFileSync(dbName, `ios/native63/${dbName}`);

  if (!fs.existsSync('android/app/src/main/assets')) {
    fs.mkdirSync('android/app/src/main/assets');
  }
  fs.copyFileSync(dbName, `android/app/src/main/assets/${dbName}`);
  fs.unlinkSync(dbName);
  console.log('Database Generated!');
}

generateEmbeddableDatabase();
