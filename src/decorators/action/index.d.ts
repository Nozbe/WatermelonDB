declare module '@nozbe/watermelondb/decorators/action' {
  const action: MethodDecorator

  export default action

  export const writer: MethodDecorator
  export const reader: MethodDecorator
}
