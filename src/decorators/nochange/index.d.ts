declare module '@nozbe/watermelondb/decorators/nochange' {
  import { Decorator, RawDecorator } from "@nozbe/watermelondb/utils/common/makeDecorator";

  const nochange: Decorator<[], () => RawDecorator>;

  export default nochange;
}