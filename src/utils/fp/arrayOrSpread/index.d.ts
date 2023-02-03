type _SpreadFn<Arg, Return> = (...args: Arg[]) => Return
type _ArrayFn<Arg, Return> = (args: Arg[]) => Return

// This function takes either (...args: Arg[]) spread or (args: Arg[]) array argument
export type ArrayOrSpreadFn<Arg, Return> = _SpreadFn<Arg, Return> & _ArrayFn<Arg, Return>
