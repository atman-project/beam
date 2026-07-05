import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import type { Transport } from "./transport";

const DOWNLOAD_PROGRESS_EVENT = "beam://download-progress";

export async function initTransport(): Promise<Transport> {
  const id = await invoke<string>("endpoint_id");

  return {
    endpointId: () => id,
    pickFiles: async () => {
      const picked = await open({ multiple: true });
      if (!picked) return null;
      // Tauri 2 normally hands back string[] here, but some platforms
      // collapse a single selection to a bare string — accept both.
      if (Array.isArray(picked)) return picked;
      return typeof picked === "string" ? [picked] : null;
    },
    sendFiles: (paths) => invoke<string>("send_files", { paths }),
    downloadFiles: async (ticket, onProgress) => {
      const unlisten = onProgress
        ? await listen<number>(DOWNLOAD_PROGRESS_EVENT, (e) =>
            onProgress(e.payload),
          )
        : undefined;
      try {
        return await invoke<string[]>("download_files", { ticket });
      } finally {
        unlisten?.();
      }
    },
    transferCount: (ticket) => invoke<number>("transfer_count", { ticket }),
    cancelDownload: () => invoke<void>("cancel_download"),
  };
}
