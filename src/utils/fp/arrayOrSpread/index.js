// @flow
import invariant from '../../common/invariant'
import logger from '../../common/logger'

// Note: we have to write out three separate meanings of OnFunction because of a Babel bug
// (it will remove the parentheses, changing the meaning of the flow type)
type _SpreadFn<Arg, Return> = (...args: $ReadOnlyArray<Arg>) => Return
type _ArrayFn<Arg, Return> = (args: $ReadOnlyArray<Arg>) => Return

// This function takes either (...args: Arg[]) spread or (args: Arg[]) array argument
export type ArrayOrSpreadFn<Arg, Return> = _SpreadFn<Arg, Return> & _ArrayFn<Arg, Return>

// This helper makes it easy to make functions that can take either spread or array arguments
export default function fromArrayOrSpread<Arg>(
  args: any[],
  debugName: string,
  debugArgName: string,
): Arg[] {
  if (Array.isArray(args[0])) {
    invariant(
      args.length === 1,
      `${debugName} should be called with either a list of '${debugArgName}' arguments or a single array, but multiple arrays were passed`,
    )
    return args[0]
  }

  if (process.env.NODE_ENV !== 'production') {
    if (args.length > 200) {
      logger.warn(
        `${debugName} was called with ${args.length} arguments. It might be a performance bug. For very large arrays, pass a single array instead of a spread to avoid "Maximum callstack exceeded" error.`,
      )
    }
  }

  return args
}
