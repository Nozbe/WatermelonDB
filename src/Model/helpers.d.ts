declare module '@BuildHero/watermelondb/Model/helper' {
  import { Model } from '@BuildHero/watermelondb'

  export const hasUpdatedAt: (obj: Object) => boolean

  export const createTimestampsFor: (
    model: Model,
  ) => {
    created_at: Date
    updated_at: Date
  }

  export function addToRawSet(rawSet: string | void, value: string): string
}
