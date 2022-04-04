declare module '@BuildHero/watermelondb/utils/common/makeDecorator' {
  import { ReplaceReturn } from '@BuildHero/watermelondb/utils/common'

  export type Descriptor = Object
  export type RawDecorator = (target: Object, key: string, descriptor: Descriptor) => Descriptor
  export type RawDecoratorFactory<T extends any[]> = (...any: T) => RawDecorator

  export type Decorator<
    Args extends any[],
    Factory extends RawDecoratorFactory<Args>
    // TODO: fix
  > = ReplaceReturn<Args, Descriptor | RawDecorator, Factory>

  export default function makeDecorator<
    Args extends any[],
    T extends RawDecoratorFactory<Args>
  >(): Decorator<Args, T>
}
