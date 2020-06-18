declare module '@nozbe/watermelondb/decorators/action' {

  // Copied from lib.es5.d.ts, MethodDecorator
  function action<T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void;
  function action(): MethodDecorator;

  export default action
}
