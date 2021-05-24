// eslint-disable-next-line
import { TestScheduler } from 'rxjs/internal/testing/TestScheduler'

class WatermelonTestScheduler extends TestScheduler {
  cold(marbles, values, error) {
    return this.createColdObservable(marbles, values, error)
  }

  hot(marbles, values, error) {
    return this.createHotObservable(marbles, values, error)
  }
}

export default function makeScheduler() {
  return new WatermelonTestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })
}
