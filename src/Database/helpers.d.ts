import { BatchOperationType } from "@nozbe/watermelondb/adapters/type";

declare module '@nozbe/watermelondb/Database/helpers' {
    export const operationTypeToCollectionChangeType = (input: BatchOperationType) => string
}
  