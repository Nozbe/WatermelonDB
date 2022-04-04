declare module '@BuildHero/watermelondb/utils/common' {
  /**
   * Class
   * @desc Represents constructor of type T
   * @see https://flow.org/en/docs/types/utilities/#toc-class
   * @example
   *   class Store {}
   *   function makeStore(storeClass: Class<Store>): Store {
   *     return new storeClass();
   *   }
   */
  export type Class<T> = new (...args: any[]) => T

  /**
   * A function type whose return value is a function that takes
   * the same parameters as the input function, but returns a fixed
   * type, also passed via parameter.
   * */
  export type ReplaceReturn<Args extends any[], R, F extends (...args: Args) => R> = (
    ...args: Args
  ) => R

  /**
   * $Call
   * @desc get the return type from a given typeof expression
   * @see https://flow.org/en/docs/types/utilities/#toc-call
   * @example
   *   // Common use-case
   *   const add = (amount: number) => ({ type: 'ADD' as 'ADD', payload: amount });
   *   type AddAction = $Call<typeof returnOfIncrement>; // { type: 'ADD'; payload: number }
   *
   *   // Examples migrated from Flow docs
   *   type ExtractPropType<T extends { prop: any }> = (arg: T) => T['prop'];
   *   type Obj = { prop: number };
   *   type PropType = $Call<ExtractPropType<Obj>>; // number
   *
   *   type ExtractReturnType<T extends () => any> = (arg: T) => ReturnType<T>;
   *   type Fn = () => number;
   *   type FnReturnType = $Call<ExtractReturnType<Fn>>; // number
   */
  export type $Call<Fn extends (...args: any[]) => any> = Fn extends (arg: any) => infer RT
    ? RT
    : never
}
