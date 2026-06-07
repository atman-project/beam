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
# For Linux, install system dependencies first:
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev \
                 librsvg2-dev libssl-dev patchelf

pnpm install
pnpm tauri dev                  # desktop
pnpm android:dev                # Android (needs Android SDK + NDK)
```

## Release

Tauri can only build for the host OS, so each desktop installer must be
produced on a matching machine (macOS for `.dmg`, Windows for `.msi`,
Linux for `.deb` / AppImage).

### macOS

```sh
pnpm tauri build     # → src-tauri/target/release/bundle/{dmg,macos}/
```
Produces an unsigned `.app` and `.dmg`. For distribution, sign + notarize
with an Apple Developer ID by setting `APPLE_SIGNING_IDENTITY` and
`APPLE_API_KEY` / `APPLE_API_ISSUER` env vars before the command — see
[Tauri's macOS signing guide](https://v2.tauri.app/distribute/sign/macos/).

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

### Android

Requires Android SDK 24+ and NDK; `ANDROID_HOME` and `NDK_HOME` must be set.
```sh
pnpm android:init     # one-time per checkout
pnpm android:build    # → src-tauri/gen/android/app/build/outputs/
```
Outputs unsigned APK and AAB. Sign the AAB with a release keystore before
uploading to Play Console — see [Tauri's Android signing guide](https://v2.tauri.app/distribute/google-play/).

### iOS

iOS is **not** built from this repo. See
[beam-ios](https://github.com/atman-project/beam-ios) for the native
Swift app and its build instructions.
