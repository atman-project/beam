import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Check, Copy, FolderOpen, Loader2, Upload } from "lucide-react";
import { initTransport } from "./lib/transport-desktop";
import type { Transport } from "./lib/transport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Tab = "send" | "receive";

export function App() {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [tab, setTab] = useState<Tab>("send");

  useEffect(() => {
    let cancelled = false;
    initTransport()
      .then((t) => {
        if (!cancelled) setTransport(t);
      })
      .catch((e) => {
        console.error("transport init failed", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-5"
      style={{
        paddingTop: "calc(20px + env(safe-area-inset-top))",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
      }}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="send" className="flex-1">
            Send
          </TabsTrigger>
          <TabsTrigger value="receive" className="flex-1">
            Receive
          </TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="mt-4">
          <SendScreen transport={transport} />
        </TabsContent>
        <TabsContent value="receive" className="mt-4">
          <ReceiveScreen transport={transport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SendScreen({ transport }: { transport: Transport | null }) {
  const [ticket, setTicket] = useState<string | null>(null);
  const [pickedPaths, setPickedPaths] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState(0);

  async function pickAndShare() {
    if (!transport) return;
    setError(null);
    setTicket(null);
    setPickedPaths([]);
    setReceived(0);
    try {
      const paths = await transport.pickFiles();
      if (!paths || paths.length === 0) return;
      setPickedPaths(paths);
      setWorking(true);
      const t = await transport.sendFiles(paths);
      setTicket(t);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setTicket(null);
    setPickedPaths([]);
    setError(null);
    setReceived(0);
  }

  useEffect(() => {
    if (!transport || !ticket) return;
    let cancelled = false;
    const currentTicket = ticket;
    const tick = async () => {
      try {
        const n = await transport.transferCount(currentTicket);
        if (!cancelled) setReceived(n);
      } catch {
        // Swallow transient poll failures; keep the last good count.
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [transport, ticket]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {!ticket ? (
          <>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Pick one or more files to share. We'll show a QR code your friend
              can scan.
            </p>
            <Button
              className="h-11 w-full"
              disabled={!transport || working}
              onClick={pickAndShare}
            >
              {working ? <Loader2 className="animate-spin" /> : <Upload />}
              {working ? "Preparing…" : "Pick files"}
            </Button>
            {pickedPaths.length > 0 && working && (
              <p className="text-muted-foreground text-center text-sm">
                Hashing{" "}
                {pickedPaths.length === 1
                  ? basename(pickedPaths[0])
                  : `${pickedPaths.length} files`}
                …
              </p>
            )}
          </>
        ) : (
          <>
            <div className="self-center rounded-xl bg-white p-4 shadow-lg ring-1 ring-white/10">
              <QRCodeSVG value={ticket} size={220} level="M" />
            </div>
            {pickedPaths.length > 0 && (
              <p className="text-foreground text-center text-sm font-medium">
                {pickedPaths.length === 1
                  ? basename(pickedPaths[0])
                  : `${pickedPaths.length} files`}
              </p>
            )}
            <p className="text-muted-foreground text-center text-sm">
              Received by{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {received}
              </span>{" "}
              {received >= 2 ? "friends" : "friend"}
            </p>
            <CopyableMono value={ticket} />
            <Button variant="secondary" className="w-full" onClick={reset}>
              Pick another file
            </Button>
            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              Keep this window open until your friend has finished receiving.
            </p>
          </>
        )}
        {error && <ErrorBox message={error} />}
      </CardContent>
    </Card>
  );
}

function ReceiveScreen({ transport }: { transport: Transport | null }) {
  const [manualTicket, setManualTicket] = useState("");
  const [working, setWorking] = useState(false);
  const [savedPaths, setSavedPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bytesReceived, setBytesReceived] = useState(0);
  const startTimeRef = useRef(0);

  async function receive(ticket: string) {
    if (!transport || !ticket.trim()) return;
    setError(null);
    setSavedPaths([]);
    setBytesReceived(0);
    startTimeRef.current = performance.now();
    setWorking(true);
    try {
      const paths = await transport.downloadFiles(ticket.trim(), (bytes) =>
        setBytesReceived(bytes),
      );
      setSavedPaths(paths);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="text-muted-foreground/60 flex items-center gap-3 text-[10px] font-semibold tracking-widest uppercase">
          <div className="bg-border h-px flex-1" />
          Paste a ticket
          <div className="bg-border h-px flex-1" />
        </div>

        <div className="flex gap-2">
          <Input
            value={manualTicket}
            onChange={(e) => setManualTicket(e.target.value)}
            placeholder="atman-blob1…"
            className="font-mono text-xs"
          />
          <Button
            variant="secondary"
            disabled={!transport || working || !manualTicket.trim()}
            onClick={() => receive(manualTicket)}
          >
            Receive
          </Button>
        </div>

        {working && (
          <div className="flex flex-col gap-2">
            <Progress className="h-1.5" />
            <p className="text-muted-foreground text-sm tabular-nums">
              Receiving {formatBytes(bytesReceived)}
              {formatRate(bytesReceived, startTimeRef.current) &&
                ` (${formatRate(bytesReceived, startTimeRef.current)})`}
            </p>
          </div>
        )}

        {savedPaths.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              {savedPaths.length === 1
                ? "Saved to"
                : `Received ${savedPaths.length} files:`}
            </p>
            {savedPaths.map((p) => (
              <CopyableMono key={p} value={p} />
            ))}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => revealItemInDir(savedPaths[0])}
            >
              <FolderOpen /> Open folder
            </Button>
          </div>
        )}

        {error && <ErrorBox message={error} />}
      </CardContent>
    </Card>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-destructive bg-destructive/10 border-destructive/20 rounded-md border px-3 py-2 text-sm">
      {message}
    </div>
  );
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i === -1 ? p : p.slice(i + 1);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

/**
 * Rolling average rate since transfer start. Returns `null` for the
 * first ~500ms so we don't show a wild first-sample estimate.
 */
function formatRate(bytes: number, startTimeMs: number): string | null {
  if (bytes === 0 || startTimeMs === 0) return null;
  const elapsedMs = performance.now() - startTimeMs;
  if (elapsedMs < 500) return null;
  return `${formatBytes((bytes * 1000) / elapsedMs)}/s`;
}

function CopyableMono({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("clipboard copy failed", e);
    }
  }

  return (
    <div className="bg-background border-border hover:border-border/80 group relative rounded-md border px-3 py-2.5 pr-10 transition-colors">
      <div className="text-muted-foreground font-mono text-xs leading-relaxed break-all">
        {value}
      </div>
      <button
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
