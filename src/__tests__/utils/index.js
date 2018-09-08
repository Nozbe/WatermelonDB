// @flow

import makeScheduler from './makeScheduler'

async function expectToRejectWithMessage(
  promise: Promise<*>,
  message: string | RegExp,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    message: expect.stringMatching(message),
  })
}

export { expectToRejectWithMessage, makeScheduler }
