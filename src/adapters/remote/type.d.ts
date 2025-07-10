import { AppSchema } from "../../Schema";
import { SchemaMigrations } from "../../Schema/migrations";
import { ResultCallback } from "../../utils/fp/Result";

export type RemoteHandler = (op: string, args: any[], callback: ResultCallback<any>) => void;

export type RemoteAdapterOptions = {
    schema: AppSchema, 
    migrations?: SchemaMigrations,
    handler: RemoteHandler,
}