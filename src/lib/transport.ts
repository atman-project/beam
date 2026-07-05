export interface Transport {
  endpointId(): string;
  /** Multi-select file picker; `null` on cancel. */
  pickFiles(): Promise<string[] | null>;
  /** Returns a shareable ticket. */
  sendFiles(paths: string[]): Promise<string>;
  /**
   * Returns one saved path per file in the order they arrive.
   *
   * `onProgress` fires with the cumulative bytes received so far (throttled
   * to ~10Hz on the desktop transport).
   */
  downloadFiles(
    ticket: string,
    onProgress?: (bytesReceived: number) => void,
  ): Promise<string[]>;
  /** Cancel the in-flight `downloadFiles`. No-op if nothing is running. */
  cancelDownload(): Promise<void>;
  /** Receiver count for `ticket`. Identical content shared twice shares
   *  its counter — the hash is the same. */
  transferCount(ticket: string): Promise<number>;
}
