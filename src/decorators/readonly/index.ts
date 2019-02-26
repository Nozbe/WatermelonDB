declare module '@nozbe/watermelondb/decorators/readonly' {
  import { Decorator, RawDecorator } from "@nozbe/watermelondb/utils/common/makeDecorator";

  const readonly: Decorator<[], () => RawDecorator>;

  export default readonly;
}