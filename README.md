# Beam

Share photos, videos, and files without relying on cloud service providers. No accounts, no servers. Transfer directly between devices, encrypted end-to-end.

Beam is built on top of [atman](https://github.com/atman-project/atman),
which is a Rust library that implements core protocols for peer-to-peer
networking and file transfer.

Beam is an open-source software available on iOS, Android, macOS, Windows, and Linux. The iOS version is implemented in [beam-ios](https://github.com/atman-project/beam-ios) as a native Swift app, and the Android version is implemented in [beam-android](https://github.com/atman-project/beam-android). All desktop versions are implemented in this repo using [Tauri](https://v2.tauri.app/).

## Repo layout

```
beam/
├── src-tauri/                  Tauri Rust shell
├── src/                        React frontend used by Tauri
├── public/, package.json, …    Vite / pnpm scaffolding
└── Cargo.toml                  workspace, one member: src-tauri
```

## Develop

```sh
# For Linux, install system dependencies first:
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev \
                 librsvg2-dev libssl-dev patchelf

pnpm install
pnpm tauri dev                  # desktop
```

## Release

Tauri can only build for the host OS, so each desktop installer must be
produced on a matching machine (macOS for `.dmg`, Windows for `.msi`,
Linux for `.deb` / AppImage).

All of the following distribution processes are automated as an [workflow](.github/workflows/release.yml),
which is triggered automatically when a new tag is pushed.

### macOS

```sh
pnpm tauri build     # → src-tauri/target/release/bundle/{dmg,macos}/
```
Produces an unsigned `.app` and `.dmg`.

For distribution, the app must be signed and notarized. The following environment
variables must be set before running `pnpm tauri build`. For details, see
[Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/):
- Signing
  - `APPLE_SIGNING_IDENTITY`: *Developer ID Application* certificate ID
- Notarization
  - `APPLE_API_ISSUER`: Issuer ID of App Store Connect API key
  - `APPLE_API_KEY`: App Store Connect API key ID
  - `APPLE_API_KEY_PATH`: Path to App Store Connect API private key (in `.p8` format)


### Windows

```sh
pnpm tauri build      # → src-tauri/target/release/bundle/{msi,nsis}/
```
Produces `.msi` and `.exe` installers. Unsigned builds trigger SmartScreen;
sign with `signtool` or set `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD`
env vars — see [Tauri's Windows signing guide](https://v2.tauri.app/distribute/sign/windows/).

### Linux

System packages required first:
```sh
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev \
                 librsvg2-dev libssl-dev patchelf
pnpm tauri build      # → src-tauri/target/release/bundle/{deb,appimage,rpm}/
```
