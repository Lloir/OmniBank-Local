#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::time::Duration;
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

struct SidecarState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    pid: Mutex<Option<u32>>,
}

fn kill_sidecar(state: &SidecarState) {
    // First, try the Tauri child.kill() method
    if let Ok(mut guard) = state.child.lock() {
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }

    // Fallback: force-kill the entire process tree by PID
    if let Ok(guard) = state.pid.lock() {
        if let Some(pid) = *guard {
            let _ = std::process::Command::new("taskkill")
                .args(["/T", "/F", "/PID", &pid.to_string()])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
        }
    }

    // Ultimate fallback: kill by executable name
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "omnibank-api.exe"])
        .creation_flags(0x08000000)
        .output();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Spawn the FastAPI sidecar
            let sidecar_command = app.shell().sidecar("omnibank-api")
                .expect("Failed to create sidecar command");

            let (mut rx, child) = sidecar_command.spawn()
                .expect("Failed to spawn sidecar");

            // Get the OS PID for fallback cleanup
            let pid = child.pid();

            // Store both the child handle and PID
            app.manage(SidecarState {
                child: Mutex::new(Some(child)),
                pid: Mutex::new(Some(pid)),
            });

            // Log sidecar output in a background task
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[sidecar:out] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[sidecar] terminated: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            // Wait for the API server to become ready before showing the window
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                for _ in 0..30 {
                    if let Ok(resp) = reqwest::blocking::get("http://127.0.0.1:8434/api/health") {
                        if resp.status().is_success() {
                            // Server is ready — show the main window
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                            }
                            return;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
                eprintln!("Warning: sidecar health check timed out after 15s");
                // Show window anyway so the user can see an error
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building OmniBank")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Guaranteed to fire on app exit — kill the sidecar
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    kill_sidecar(&state);
                }
            }
        });
}

