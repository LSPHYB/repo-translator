// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//
// Sidecar lifecycle (Task 11): the Python backend (repo_translator/api_server.py,
// packaged by Task 10's PyInstaller spec as `repo-translator-sidecar`) is spawned
// as a Tauri sidecar via tauri-plugin-shell on app startup. It binds an
// OS-assigned port and prints exactly one JSON line to stdout before anything
// else: `{"type": "startup", "port": <n>}`. We read stdout line-by-line until
// that line parses, stash the port in app state, and expose it to the
// frontend via the `get_backend_port` command (see desktop/src/api.ts).
//
// On app exit we kill the sidecar child explicitly -- Tauri does not do this
// automatically, and an un-killed sidecar would be orphaned as a detached
// background process (the dynamic-port design means a stray orphan would
// keep a `uv`/PyInstaller-built uvicorn server listening indefinitely).
//
// IMPORTANT: PyInstaller's `--onefile` bootloader forks (rather than execs)
// a grandchild process on macOS/Linux -- confirmed by manual testing here:
// `ps -o pid,ppid` showed three live PIDs (the Tauri app, the sidecar
// bootloader, and a *separate* grandchild PID running the real interpreter)
// while the app was up. `CommandChild::kill()` (tauri-plugin-shell ->
// shared_child) only SIGKILLs the one PID Tauri spawned (the bootloader);
// it does not know about or signal the grandchild. This is a known
// PyInstaller limitation (pyinstaller/pyinstaller#3514: "Bootloader does not
// forward most signals to child process"), not something fixable from the
// Rust side via signal choice. So in addition to `child.kill()`, we walk and
// kill the sidecar's descendant processes by PID before/with the direct
// kill, via `pgrep -P`/`kill` on Unix (verified empirically that all three
// processes share one process group inherited from the Tauri app itself, so
// a process-group kill is not viable here -- it would also kill the Tauri
// app's own group).

use serde::Deserialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Kills `pid` and all of its descendant processes (recursively). Needed
/// because PyInstaller's onefile bootloader forks a grandchild that
/// `CommandChild::kill()` alone never touches -- see the module-level
/// comment above.
#[cfg(unix)]
fn kill_process_tree(pid: u32) {
    // Recurse first so children are killed before their parent disappears
    // (once the parent is gone, `pgrep -P <pid>` can no longer find it).
    if let Ok(output) = std::process::Command::new("pgrep")
        .arg("-P")
        .arg(pid.to_string())
        .output()
    {
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            if let Ok(child_pid) = line.trim().parse::<u32>() {
                kill_process_tree(child_pid);
            }
        }
    }
    let _ = std::process::Command::new("kill")
        .arg("-9")
        .arg(pid.to_string())
        .output();
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    // `/T` kills the whole subtree; Windows does not have the
    // fork-without-exec quirk PyInstaller exhibits on Unix, but this is
    // kept symmetric/defensive in case the bootloader spawns a helper
    // process there too.
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
}

#[derive(Debug, Deserialize)]
struct StartupMessage {
    #[serde(rename = "type")]
    kind: String,
    port: u16,
}

/// Shared app state: the sidecar's resolved port (once known) and a handle to
/// the running child process (so it can be killed on exit). Both start as
/// `None`/empty and are filled in once the sidecar's startup handshake
/// completes.
#[derive(Default)]
struct SidecarState {
    port: Mutex<Option<u16>>,
    child: Mutex<Option<CommandChild>>,
}

/// Emitted to the frontend once the sidecar's startup line has been parsed
/// (success) or if the sidecar exits/errors before producing one (failure).
/// The frontend's startup gate (App.tsx) listens for this instead of polling
/// Rust state, since the handshake happens asynchronously off the `setup`
/// hook.
#[derive(Clone, serde::Serialize)]
struct SidecarReadyPayload {
    port: Option<u16>,
    error: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Returns the sidecar's resolved port. Called by the frontend
/// (`api.ts`'s `initBackendPort`) once, at startup, after waiting for the
/// `sidecar-ready` event. Returns an error if the handshake never completed
/// (e.g. called too early, or the sidecar failed to start) so the frontend
/// never silently falls back to a wrong port inside the packaged app.
#[tauri::command]
fn get_backend_port(state: tauri::State<SidecarState>) -> Result<u16, String> {
    state
        .port
        .lock()
        .unwrap()
        .ok_or_else(|| "sidecar port not yet available".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState::default())
        .invoke_handler(tauri::generate_handler![greet, get_backend_port])
        .setup(|app| {
            let app_handle = app.handle().clone();

            let sidecar_command = app_handle
                .shell()
                .sidecar("repo-translator-sidecar")
                .expect("failed to create sidecar command for repo-translator-sidecar");
            let (mut rx, child) = sidecar_command
                .spawn()
                .expect("failed to spawn repo-translator-sidecar sidecar");

            // Stash the child immediately so it can be killed on exit even
            // if the startup handshake below never completes.
            app_handle
                .state::<SidecarState>()
                .child
                .lock()
                .unwrap()
                .replace(child);

            tauri::async_runtime::spawn(async move {
                let mut resolved = false;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line_bytes) => {
                            let line = String::from_utf8_lossy(&line_bytes);
                            if resolved {
                                continue;
                            }
                            match serde_json::from_str::<StartupMessage>(line.trim()) {
                                Ok(msg) if msg.kind == "startup" => {
                                    app_handle
                                        .state::<SidecarState>()
                                        .port
                                        .lock()
                                        .unwrap()
                                        .replace(msg.port);
                                    resolved = true;
                                    let _ = app_handle.emit(
                                        "sidecar-ready",
                                        SidecarReadyPayload {
                                            port: Some(msg.port),
                                            error: None,
                                        },
                                    );
                                }
                                _ => {
                                    // Not the startup line (or a stray print
                                    // before it) -- log and keep reading,
                                    // per the brief's "skip/log any line
                                    // that doesn't parse" guidance.
                                    eprintln!(
                                        "[sidecar stdout, awaiting startup line] {}",
                                        line.trim()
                                    );
                                }
                            }
                        }
                        CommandEvent::Stderr(line_bytes) => {
                            eprintln!(
                                "[sidecar stderr] {}",
                                String::from_utf8_lossy(&line_bytes).trim()
                            );
                        }
                        CommandEvent::Error(err) => {
                            if !resolved {
                                let _ = app_handle.emit(
                                    "sidecar-ready",
                                    SidecarReadyPayload {
                                        port: None,
                                        error: Some(err),
                                    },
                                );
                                resolved = true;
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            if !resolved {
                                let _ = app_handle.emit(
                                    "sidecar-ready",
                                    SidecarReadyPayload {
                                        port: None,
                                        error: Some(format!(
                                            "sidecar exited before startup (code: {:?})",
                                            payload.code
                                        )),
                                    },
                                );
                            }
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Kill the sidecar on every path that ends the app: the last
            // window closing, an explicit exit request, or final teardown.
            // Without this the sidecar (a uvicorn server bound to its own
            // OS-assigned port) would be orphaned as a detached background
            // process every time the app quits.
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                if let Some(child) = app_handle.state::<SidecarState>().child.lock().unwrap().take() {
                    // Kill descendants first (the PyInstaller bootloader's
                    // forked grandchild -- see module comment) while the
                    // direct child PID is still resolvable as their parent,
                    // then kill the direct child itself via the plugin's
                    // own API (ignoring the error if it's already gone).
                    kill_process_tree(child.pid());
                    let _ = child.kill();
                }
            }
        });
}
