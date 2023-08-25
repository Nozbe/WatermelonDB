import {app} from '@react-native-windows/automation';

describe('WatermelonDB', () => {
  test('Check integration test status', async () => {
    const view = await app.findElementByTestID('WatermelonTesterStatus');

    await app.waitUntil(async () => {
      const statusText = await view.getText();
      console.log(statusText)
      return statusText.includes('Done');
    }) 
  });
})