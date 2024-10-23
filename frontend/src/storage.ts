//Simple json local storage. Should persist until a user or their browser clears their cache
//Current uses are:
// - linking on-chain nodes with off-chain computers (local ip addresses and ports) for monitoring

//This seems unnecessarily complex for middleware that essentially runs JSON.stringify and JSON.parse
import { Bounty, ClientNode } from "../../execution-client/types"; //TODO fix me later

type CommonStorage = {
  lastUpdated: number;
};
export type NodeStorageValue = ClientNode & { url: string };
export type NodeStorage = { [key: string]: NodeStorageValue };
export type BountyStorageValue = Bounty;
export type BountyStorage = { [key: string]: BountyStorageValue };

//TODO create interface for this
export class TransientStorage<StorageType = any> {
  constructor() {}

  public get(key: string): StorageType | undefined {
    const backend = window.localStorage;
    const s = backend.getItem(key);
    if (!s) return undefined;
    return JSON.parse(s);
  }
  public getOrSetDefault(key: string, defaultValue: StorageType): StorageType {
    const s = this.get(key);
    if (s) {
      console.log("Dumping key?", key, s);
      return s;
    }
    this.set(key, defaultValue);
    return defaultValue;
  }

  public set(key: string, value: StorageType) {
    const backend = window.localStorage;
    console.log("Setting key?", key, value);
    backend.setItem(key, JSON.stringify(value));
  }

  public delete(key: string) {
    const backend = window.localStorage;
    backend.removeItem(key);
  }
}
