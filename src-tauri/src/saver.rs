use std::path::{Path, PathBuf};

use tauri::AppHandle;
#[cfg(target_os = "android")]
use tauri::Manager;

/// Save a received file to a user-visible location.
///
/// - **Desktop**: `~/Downloads/beam/`.
/// - **Android**: shared `Pictures` / `Movies` / `Download` system
///   collections (MediaStore-backed on API 29+), routed by file type so
///   received media lands where the system gallery looks for it.
pub async fn save(app: &AppHandle, name: &str, bytes: &[u8]) -> anyhow::Result<PathBuf> {
    let kind = media_kind(name);
    let dir = pick_dir(app, kind)?;
    tokio::fs::create_dir_all(&dir).await?;
    let path = unique_path(&dir, name);
    tokio::fs::write(&path, bytes).await?;
    Ok(path)
}

fn pick_dir(app: &AppHandle, kind: MediaKind) -> anyhow::Result<PathBuf> {
    #[cfg(target_os = "android")]
    {
        // `picture_dir` etc. resolve to the shared system collections,
        // outside the app sandbox — so received files survive uninstall
        // and are visible to other apps (Photos, gallery, etc.).
        let resolver = app.path();
        let base = match kind {
            MediaKind::Image => resolver.picture_dir()?,
            MediaKind::Video => resolver.video_dir()?,
            MediaKind::Other => resolver.download_dir()?,
        };
        return Ok(base.join("beam"));
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, kind);
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        Ok(home.join("Downloads").join("beam"))
    }
}

fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (name.to_string(), String::new()),
    };
    for i in 1..10_000 {
        let candidate = dir.join(format!("{stem} ({i}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!("{stem}-{}{ext}", std::process::id()))
}

#[derive(Copy, Clone)]
enum MediaKind {
    Image,
    Video,
    Other,
}

fn media_kind(name: &str) -> MediaKind {
    match name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "heif" | "bmp" | "tiff") => {
            MediaKind::Image
        }
        Some("mp4" | "mov" | "m4v" | "hevc" | "qt") => MediaKind::Video,
        _ => MediaKind::Other,
    }
}
