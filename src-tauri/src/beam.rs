use std::path::PathBuf;

use atman::{Atman, BlobTicket, Command, Config, NetworkConfig, config::secret_key_from_hex};
use tauri::{AppHandle, Manager, State};
use tokio::sync::{mpsc, oneshot};

pub struct AtmanState {
    command_sender: mpsc::Sender<Command>,
}

pub async fn init(app: &AppHandle) -> anyhow::Result<()> {
    // A fresh identity per launch is fine for our QR-handshake UX —
    // every ticket already carries the live endpoint addr, so peers
    // don't need a stable id to find us across sessions.
    let identity_hex = random_hex_32();
    let identity = secret_key_from_hex(identity_hex.as_bytes())
        .map_err(|e| anyhow::anyhow!("identity decode: {e}"))?;

    let config = Config {
        identity,
        network: NetworkConfig {
            key: None,
            custom_relay_url: None,
        },
    };

    let (atman, command_sender) =
        Atman::new(config).map_err(|e| anyhow::anyhow!("atman init: {e}"))?;

    // Register state before atman finishes coming online so Tauri
    // commands fired during startup queue on the mpsc channel instead
    // of failing with "state not found".
    app.manage(AtmanState { command_sender });

    let (ready_sender, ready_receiver) = oneshot::channel();
    tokio::spawn(async move { atman.run(ready_sender).await });
    ready_receiver
        .await
        .map_err(|_| anyhow::anyhow!("ready channel dropped"))?
        .map_err(|e| anyhow::anyhow!("atman run: {e}"))?;
    Ok(())
}

fn random_hex_32() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("OS RNG unavailable");
    let mut s = String::with_capacity(64);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(&mut s, "{b:02x}");
    }
    s
}

/// Gates the camera-based QR scanner: only meaningful on a phone, since
/// scanning the QR from your own desktop screen is awkward.
#[tauri::command]
pub fn is_mobile() -> bool {
    cfg!(any(target_os = "ios", target_os = "android"))
}

/// How many receivers have pulled `ticket` so far. Identical content
/// shared more than once shares its counter because the hash is the
/// same on every share.
#[tauri::command]
pub async fn transfer_count(state: State<'_, AtmanState>, ticket: String) -> Result<u64, String> {
    let ticket: BlobTicket = ticket
        .parse()
        .map_err(|e: atman::BlobTicketError| e.to_string())?;
    let (reply_sender, reply_receiver) = oneshot::channel();
    state
        .command_sender
        .send(Command::Blobs(
            atman::command::blobs::Command::FilesTransferCount {
                hash: ticket.inner.hash(),
                reply_sender,
            },
        ))
        .await
        .map_err(|e| e.to_string())?;
    reply_receiver
        .await
        .map(|maybe_count| maybe_count.unwrap_or(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn endpoint_id(state: State<'_, AtmanState>) -> Result<String, String> {
    let (reply_sender, reply_receiver) = oneshot::channel();
    state
        .command_sender
        .send(Command::Status { reply_sender })
        .await
        .map_err(|e| e.to_string())?;
    let status = reply_receiver.await.map_err(|e| e.to_string())?;
    Ok(status.node_id.to_string())
}

/// Import one or more files into atman's blob store and return a ticket
/// the UI can render as a QR code.
#[tauri::command]
pub async fn send_files(
    state: State<'_, AtmanState>,
    paths: Vec<String>,
) -> Result<String, String> {
    let paths: Vec<PathBuf> = paths.iter().map(|p| parse_path(p)).collect();
    let (reply_sender, reply_receiver) = oneshot::channel();
    state
        .command_sender
        .send(Command::Blobs(atman::command::blobs::Command::SendFiles {
            paths,
            reply_sender,
        }))
        .await
        .map_err(|e| e.to_string())?;
    let ticket = reply_receiver
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(ticket.to_string())
}

/// Pull every blob `ticket` references into a cache dir, route each one
/// through [`crate::saver::save`] to its final user-visible location,
/// and return those paths in the order received.
#[tauri::command]
pub async fn download_files(
    app: AppHandle,
    state: State<'_, AtmanState>,
    ticket: String,
) -> Result<Vec<String>, String> {
    let ticket: BlobTicket = ticket
        .parse()
        .map_err(|e: atman::BlobTicketError| e.to_string())?;

    let staging = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("beam-staging");
    tokio::fs::create_dir_all(&staging)
        .await
        .map_err(|e| e.to_string())?;

    let (reply_sender, reply_receiver) = oneshot::channel();
    state
        .command_sender
        .send(Command::Blobs(
            atman::command::blobs::Command::DownloadFiles {
                ticket,
                save_dir: staging.clone(),
                reply_sender,
            },
        ))
        .await
        .map_err(|e| e.to_string())?;
    let staged_paths = reply_receiver
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let mut final_paths = Vec::with_capacity(staged_paths.len());
    for staged in staged_paths {
        let name = staged
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("incoming.bin")
            .to_string();
        let bytes = tokio::fs::read(&staged).await.map_err(|e| e.to_string())?;
        let final_path = crate::saver::save(&app, &name, &bytes)
            .await
            .map_err(|e| e.to_string())?;
        // Best-effort staging-file cleanup.
        let _ = tokio::fs::remove_file(&staged).await;
        final_paths.push(final_path.to_string_lossy().into_owned());
    }

    Ok(final_paths)
}

/// Tauri's iOS file-picker hands back `file://` URLs (often
/// percent-encoded); desktop pickers return native paths. Decode the URL
/// form back to a filesystem path; pass anything else through.
fn parse_path(input: &str) -> PathBuf {
    if input.starts_with("file://")
        && let Ok(url) = url::Url::parse(input)
        && let Ok(p) = url.to_file_path()
    {
        return p;
    }
    PathBuf::from(input)
}
