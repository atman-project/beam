# Beam

Share photos, videos, and files without relying on cloud service providers. No accounts, no servers. Transfer directly between devices, encrypted end-to-end.

Beam is built on top of [atman](https://github.com/atman-project/atman),
which is a Rust library that implements core protocols for peer-to-peer
networking and file transfer.

Beam is an open-source software available on iOS, Android, macOS, Windows, and Linux. The iOS version is implemented in [beam-ios](https://github.com/atman-project/beam-ios) as a native Swift app, while all other platforms are implemented in this repo using [Tauri](https://v2.tauri.app/).

## Repo layout

```
beam/
├── src-tauri/                  Tauri Rust shell (desktop + Android)
├── src/                        React frontend used by Tauri
├── public/, package.json, …    Vite / pnpm scaffolding
└── Cargo.toml                  workspace, one member: src-tauri
```

## Develop

```sh
pnpm install
pnpm tauri dev                  # desktop
pnpm android:dev                # Android (needs Android SDK + NDK)
```
