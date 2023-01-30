export type Descriptor = Object
export type RawDecorator = (target: Object, key: string, descriptor: Descriptor) => Descriptor
export type Decorator = (...any: any[]) => Descriptor | RawDecorator

export default function makeDecorator(decorator: (...any: any[]) => RawDecorator): Decorator
