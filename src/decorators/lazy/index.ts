declare module '@nozbe/watermelondb/decorators/lazy' {
  import { RawDecorator } from "@nozbe/watermelondb/utils/common/makeDecorator";

  const immutableRelation: RawDecorator;

  export default immutableRelation;
}