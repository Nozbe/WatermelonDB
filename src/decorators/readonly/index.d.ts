declare module '@BuildHero/watermelondb/decorators/readonly' {
  // Copied from lib.es5.d.ts, PropertyDecorator
  function readonly(target: Object, propertyKey: string | symbol): void
  function readonly(): PropertyDecorator

  export default readonly
}
