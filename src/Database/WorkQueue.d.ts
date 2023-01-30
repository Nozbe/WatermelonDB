import type Model from '../Model'
import type Database from './index'
import { $ReadOnlyArray } from '../types';

export interface ReaderInterface {
  callReader<T>(reader: () => Promise<T>): Promise<T>;
}

export interface WriterInterface extends ReaderInterface {
  callWriter<T>(writer: () => Promise<T>): Promise<T>;
  batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void>;
}

type WorkQueueItem<T> = {
  work: (_: ReaderInterface | WriterInterface) => Promise<T>;
  isWriter: boolean;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  description?: string;
}

export default class WorkQueue {
  _db: Database

  _queue: WorkQueueItem<any>[]

  _subActionIncoming: boolean

  constructor(db: Database)

  get isWriterRunning(): boolean

  enqueue<T>(
    work: (_: ReaderInterface | WriterInterface) => Promise<T>,
    description: string | undefined,
    isWriter: boolean,
  ): Promise<T>

  subAction<T>(work: () => Promise<T>): Promise<T>

  _executeNext(): Promise<void>

  _abortPendingWork(): void
}
