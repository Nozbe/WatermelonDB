import { AppSchema } from "../../Schema";
import { SchemaMigrations } from "../../Schema/migrations";
import { ResultCallback } from "../../utils/fp/Result";

type RemoteHandler = (op: string, args: any[], callback: ResultCallback<any>) => void;

type RemoteAdapterOptions = {
    schema: AppSchema, 
    migrations?: SchemaMigrations,
    handler: RemoteHandler,
}