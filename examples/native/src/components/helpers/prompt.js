import prompt from 'react-native-prompt-android';

export default function devPrompt(message) {
  return new Promise((resolve) => {
    prompt(message, null, [{ text: 'OK', onPress: (input) => resolve(input) }], {
      type: 'plain-text',
      cancelable: false,
    });
  });
}
