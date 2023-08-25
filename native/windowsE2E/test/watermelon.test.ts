import {app} from '@react-native-windows/automation';
import {dumpVisualTree} from '@react-native-windows/automation-commands';

console.log('hello')

describe('WatermelonDB', () => {
console.log('hello2')
test('Text', async () => {
    console.log('1')
    const view = await app.findElementByTestID('WatermelonTesterStatus');
    console.log('2')
    console.log(await view.getText())
    console.log('3')
    
    // await app.waitUntil(async () => {
    //   const headerText = await view.getText();
    //   return headerText.includes('Welcome');
    // }) 
    
  });
})