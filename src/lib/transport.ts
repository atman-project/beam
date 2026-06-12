export interface Transport {
  endpointId(): string;
  /** Multi-select file picker; `null` on cancel. */
  pickFiles(): Promise<string[] | null>;
  /** Returns a shareable ticket. */
  sendFiles(paths: string[]): Promise<string>;
  /** Returns one saved path per file in the order they arrive. */
  downloadFiles(ticket: string): Promise<string[]>;
  /** Receiver count for `ticket`. Identical content shared twice shares
   *  its counter — the hash is the same. */
  transferCount(ticket: string): Promise<number>;
}
