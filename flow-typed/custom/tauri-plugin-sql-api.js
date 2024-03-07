declare class TauriDB {
  execute(query: string, args: any[]): Promise<any>;
  select(query: string, args: any[]): Promise<any[]>;
  close(): Promise<void>;
}
declare module 'tauri-plugin-sql-api' {
  declare module.exports: {
    load: (path: string) => Promise<TauriDB>
  };
}

