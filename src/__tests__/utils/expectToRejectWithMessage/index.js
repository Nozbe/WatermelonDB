// @flow
import expect from 'expect-rn'

export default async function expectToRejectWithMessage(
  promise: Promise<*>,
  message: string | RegExp,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    message: expect.stringMatching(message),
  })
}
