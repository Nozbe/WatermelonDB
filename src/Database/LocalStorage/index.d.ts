declare module '@nozbe/watermelondb/Database/LocalStorage' {
  export default class LocalStorage {
    public get(key: string): Promise<any>
    public set(key: string, value: any): Promise<void>
    public remove(key: string): Promise<void>
  }
}
