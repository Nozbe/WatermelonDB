export type Descriptor = any
export type RawDecorator = (target: any, key: string, descriptor: Descriptor) => Descriptor
export type Decorator = (...rest: any) => Descriptor | RawDecorator

// Converts a function with signature `(args) => (target, key, descriptor)` to a decorator
// that works both when called `@decorator foo` and with arguments, like `@decorator(arg) foo`
export default function makeDecorator(decorator: (...rest: any) => RawDecorator): Decorator {
  return (...args) => {
    // Decorator called with an argument, JS expects a decorator function
    if (args.length < 3) {
      return decorator(...args)
    }

    // Decorator called without an argument, JS expects a descriptor object
    // @ts-ignore
    return decorator()(...args)
  }
}
