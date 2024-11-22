// @flow

import { type ResultCallback } from '../../utils/fp/Result'
import type { AppSchema } from '../../Schema'
import type { SchemaMigrations } from '../../Schema/migrations'

export type RemoteHandler = (op: string, args: any[], callback: ResultCallback<any>) => void;

export type RemoteAdapterOptions = {
    schema: AppSchema, 
    migrations?: SchemaMigrations,
    handler: RemoteHandler,
}