import {app} from '@react-native-windows/automation';

describe('WatermelonDB', () => {
  test('Check integration test status', async () => {
    const view = await app.findElementByTestID('WatermelonTesterStatus');
    console.log(await view.getText())
  });
})