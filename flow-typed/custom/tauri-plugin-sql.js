declare class TauriDB {
  execute(query: string, args?: any[]): Promise<any>;
  select(query: string, args?: any[]): Promise<any[]>;
  close(): Promise<void>;
}
declare module 'tauri-plugin-sql' {
  declare export default {
    load: (path: string) => Promise<TauriDB>
  };
}

