declare module '@BuildHero/watermelondb/decorators/nochange' {
  // Copied from lib.es5.d.ts, PropertyDecorator
  function nochange(target: Object, propertyKey: string | symbol): void
  function nochange(): PropertyDecorator

  export default nochange
}
