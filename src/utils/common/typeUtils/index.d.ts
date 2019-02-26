declare module '@nozbe/watermelondb/utils/common/typeUtils' {
  // tslint:disable-next-line:interface-over-type-literal
  type Class<T> = { new(): T };

  /**
   * A function type whose return value is a function that takes
   * the same parameters as the input function, but returns a fixed
   * type, also passed via parameter.
   * */
  type ReplaceReturn<
    Args extends any[],
    R,
    F extends (...args: Args) => R,
    > = (...args: Args) => R;
}