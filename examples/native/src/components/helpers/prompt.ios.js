import { AlertIOS } from 'react-native'

export default function devPrompt(message) {
  return new Promise(resolve => {
    AlertIOS.prompt(message, null, input => resolve(input), 'plain-text')
  })
}
