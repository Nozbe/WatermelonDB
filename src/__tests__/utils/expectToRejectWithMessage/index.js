// @flow
import expect from '@nozbe/watermelondb_expect'

export default async function expectToRejectWithMessage(
  promise: Promise<mixed>,
  message: string | RegExp,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    message: expect.stringMatching(message),
  })
}
