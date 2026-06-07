import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { initTransport } from "./lib/transport-desktop";
import type { Transport } from "./lib/transport";
import { QrScannerModal } from "./components/QrScannerModal";

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
    <>
      <div className="tabs">
        <button
          className={tab === "send" ? "active" : ""}
          onClick={() => setTab("send")}
        >
          Send
        </button>
        <button
          className={tab === "receive" ? "active" : ""}
          onClick={() => setTab("receive")}
        >
          Receive
        </button>
      </div>

      {tab === "send" ? (
        <SendScreen transport={transport} />
      ) : (
        <ReceiveScreen transport={transport} />
      )}
    </>
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
    <div className="card">
      {!ticket ? (
        <>
          <div className="muted">
            Pick one or more files to share. We'll show a QR your friend can
            scan.
          </div>
          <button
            className="primary"
            disabled={!transport || working}
            onClick={pickAndShare}
          >
            {working ? "Preparing…" : "Pick files"}
          </button>
          {pickedPaths.length > 0 && working && (
            <div className="muted">
              Hashing{" "}
              {pickedPaths.length === 1
                ? basename(pickedPaths[0])
                : `${pickedPaths.length} files`}
              …
            </div>
          )}
        </>
      ) : (
        <>
          <div className="qr-frame">
            <QRCodeSVG value={ticket} size={220} level="M" />
          </div>
          {pickedPaths.length > 0 && (
            <div className="muted" style={{ textAlign: "center" }}>
              {pickedPaths.length === 1
                ? basename(pickedPaths[0])
                : `${pickedPaths.length} files`}
            </div>
          )}
          <div className="muted" style={{ textAlign: "center" }}>
            Received by {received} {received >= 2 ? "friends" : "friend"}
          </div>
          <CopyableMono value={ticket} />
          <button className="secondary" onClick={reset}>
            Pick another file
          </button>
          <div className="muted" style={{ textAlign: "center" }}>
            Keep this window open until your friend has finished receiving.
          </div>
        </>
      )}
      {error && <div className="muted">Error: {error}</div>}
    </div>
  );
}

function ReceiveScreen({ transport }: { transport: Transport | null }) {
  const [scanning, setScanning] = useState(false);
  const [manualTicket, setManualTicket] = useState("");
  const [working, setWorking] = useState(false);
  const [savedPaths, setSavedPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function receive(ticket: string) {
    if (!transport || !ticket.trim()) return;
    setError(null);
    setSavedPaths([]);
    setWorking(true);
    try {
      const paths = await transport.downloadFiles(ticket.trim());
      setSavedPaths(paths);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="card">
      <button
        className="primary"
        disabled={!transport || working || !transport?.isMobile()}
        onClick={() => setScanning(true)}
        title={
          transport && !transport.isMobile()
            ? "QR scanning is only available on mobile"
            : undefined
        }
      >
        {working ? "Receiving…" : "Scan QR"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="muted">Or paste a ticket:</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={manualTicket}
            onChange={(e) => setManualTicket(e.target.value)}
            placeholder="atman-blob1…"
          />
          <button
            className="secondary"
            disabled={!transport || working || !manualTicket.trim()}
            onClick={() => receive(manualTicket)}
          >
            Receive
          </button>
        </div>
      </div>

      {savedPaths.length > 0 && (
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>
            {savedPaths.length === 1
              ? "Saved to"
              : `Received ${savedPaths.length} files:`}
          </div>
          {savedPaths.map((p) => (
            <CopyableMono key={p} value={p} />
          ))}
          <button
            className="secondary"
            style={{ marginTop: 8 }}
            onClick={() => revealItemInDir(savedPaths[0])}
          >
            Open folder
          </button>
        </div>
      )}
      {error && <div className="muted">Error: {error}</div>}

      {scanning && (
        <QrScannerModal
          onResult={(value) => {
            setScanning(false);
            receive(value);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i === -1 ? p : p.slice(i + 1);
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
    <div className="copyable">
      <div className="copyable-text">{value}</div>
      <button
        className="copy-btn"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        title={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
