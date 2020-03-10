declare module '@nozbe/watermelondb/Database/helpers' {
    import { BatchOperation } from "@nozbe/watermelondb/adapters/type";
    export const operationTypeToCollectionChangeType: (input: BatchOperation) => string
}
