declare module '@nozbe/watermelondb/hooks' {
  import { Database } from '@nozbe/watermelondb';
  
  export function useDatabase(): Database | null
}