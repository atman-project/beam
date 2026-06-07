import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Transport } from "./transport";

export async function initTransport(): Promise<Transport> {
  const [id, mobile] = await Promise.all([
    invoke<string>("endpoint_id"),
    invoke<boolean>("is_mobile"),
  ]);

  return {
    endpointId: () => id,
    isMobile: () => mobile,
    pickFiles: async () => {
      const picked = await open({ multiple: true });
      if (!picked) return null;
      // Tauri 2 normally hands back string[] here, but some platforms
      // collapse a single selection to a bare string — accept both.
      if (Array.isArray(picked)) return picked;
      return typeof picked === "string" ? [picked] : null;
    },
    sendFiles: (paths) => invoke<string>("send_files", { paths }),
    downloadFiles: (ticket) => invoke<string[]>("download_files", { ticket }),
    transferCount: (ticket) => invoke<number>("transfer_count", { ticket }),
  };
}
