// @flow

type UnpackPromise = <T>(promise: Promise<T>) => T

export default function allPromisesObj<T, Key, Spec: { [Key]: Promise<T> }>(
  promisesObj: Spec,
): Promise<$ObjMap<Spec, UnpackPromise>> {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(promisesObj)
    const len = keys.length

    Promise.all(Object.values(promisesObj)).then((result) => {
      const resultObj: { [string]: mixed } = {}
      for (let i = 0; i < len; i++) {
        resultObj[keys[i]] = result[i]
      }
      resolve(resultObj)
    }, reject)
  })
}
