import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  onResult: (value: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onResult, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the scanner instance in a ref so we can clear it on unmount.
  const instanceRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled || !containerRef.current) return;
      const scanner = new Html5Qrcode("qr-reader");
      instanceRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decoded) => {
            onResult(decoded);
            scanner.stop().catch(() => {});
          },
          () => {},
        );
      } catch (e) {
        console.error("QR scanner failed to start", e);
      }
    })();
    return () => {
      cancelled = true;
      const s = instanceRef.current as { stop?: () => Promise<void> } | null;
      s?.stop?.().catch(() => {});
    };
  }, [onResult]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col gap-3 sm:max-w-sm">
        <DialogTitle>Scan QR</DialogTitle>
        <div ref={containerRef} id="qr-reader" className="w-full" />
        <Button variant="secondary" onClick={onClose} className="w-full">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
