import prompt from 'react-native-prompt-android';

export default function devPrompt(message: string): Promise<string> {
  return new Promise((resolve) => {
    prompt(message, undefined, [{ text: 'OK', onPress: (input) => resolve(input) }], {
      type: 'plain-text',
      cancelable: false,
    });
  });
}
