use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, RunEvent};

struct BackendHandle(Mutex<Option<Child>>);

fn is_backend_root(path: &PathBuf) -> bool {
    path.join("modules").join("backend_server.py").exists()
}

fn is_file(path: &PathBuf) -> bool {
    path.metadata().map(|m| m.is_file()).unwrap_or(false)
}

struct RuntimeDirs {
    app_data: PathBuf,
    models: PathBuf,
    outputs: PathBuf,
    cache: PathBuf,
    temp: PathBuf,
    uploads: PathBuf,
    switch_state: PathBuf,
}

fn find_backend_root(app: Option<&AppHandle>) -> Option<PathBuf> {
    if let Ok(p) = env::var("DEEPFACECAM_DLC") {
        let pb = PathBuf::from(p);
        if is_backend_root(&pb) {
            return Some(pb);
        }
    }

    if let Some(app_handle) = app {
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            for candidate in [
                resource_dir.join("backend"),
                resource_dir.join("generated").join("backend"),
                resource_dir.join("resources").join("backend"),
            ] {
                if is_backend_root(&candidate) {
                    return Some(candidate);
                }
            }
        }
    }

    let mut starts: Vec<PathBuf> = Vec::new();
    if let Some(m) = option_env!("CARGO_MANIFEST_DIR") {
        starts.push(PathBuf::from(m));
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            starts.push(parent.to_path_buf());
        }
    }
    if let Ok(cwd) = env::current_dir() {
        starts.push(cwd);
    }

    for start in starts {
        let mut p = start.as_path();
        for _ in 0..6 {
            let candidate = p.join("backend");
            if is_backend_root(&candidate) {
                return Some(candidate);
            }
            if let Some(sib) = p.parent().map(|pp| pp.join("backend")) {
                if is_backend_root(&sib) {
                    return Some(sib);
                }
            }
            let resource_backend = p.join("Resources").join("backend");
            if is_backend_root(&resource_backend) {
                return Some(resource_backend);
            }
            let generated_resource_backend =
                p.join("Resources").join("generated").join("backend");
            if is_backend_root(&generated_resource_backend) {
                return Some(generated_resource_backend);
            }
            if let Some(resource_sib) = p.parent().map(|pp| pp.join("Resources").join("backend")) {
                if is_backend_root(&resource_sib) {
                    return Some(resource_sib);
                }
            }
            if let Some(resource_sib) = p
                .parent()
                .map(|pp| pp.join("Resources").join("generated").join("backend"))
            {
                if is_backend_root(&resource_sib) {
                    return Some(resource_sib);
                }
            }
            let legacy = p.join("Deep-Live-Cam");
            if is_backend_root(&legacy) {
                return Some(legacy);
            }
            if let Some(sib) = p.parent().map(|pp| pp.join("Deep-Live-Cam")) {
                if is_backend_root(&sib) {
                    return Some(sib);
                }
            }
            match p.parent() {
                Some(pp) => p = pp,
                None => break,
            }
        }
    }
    None
}

fn find_bundled_backend(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(p) = env::var("DEEPFACECAM_BACKEND_BIN") {
        let pb = PathBuf::from(p);
        if is_file(&pb) {
            return Some(pb);
        }
    }

    let resource_dir = app.path().resource_dir().ok()?;
    for candidate in [
        resource_dir
            .join("generated")
            .join("macos")
            .join("backend-sidecar")
            .join("deepfacecam-backend")
            .join("deepfacecam-backend"),
        resource_dir
            .join("backend-sidecar")
            .join("deepfacecam-backend")
            .join("deepfacecam-backend"),
        resource_dir.join("deepfacecam-backend"),
    ] {
        if is_file(&candidate) {
            return Some(candidate);
        }
    }
    None
}

fn find_python(repo_root: &PathBuf) -> String {
    if let Ok(p) = env::var("DEEPFACECAM_PYTHON") {
        return p;
    }
    let windows_venv = repo_root.join(".venv").join("Scripts").join("python.exe");
    if windows_venv.exists() {
        return windows_venv.to_string_lossy().into_owned();
    }
    let venv = repo_root.join(".venv").join("bin").join("python");
    if venv.exists() {
        return venv.to_string_lossy().into_owned();
    }
    if let Some(workspace) = repo_root.parent().and_then(|p| p.parent()) {
        let migration_venv = workspace
            .join("Deep-Live-Cam")
            .join(".venv")
            .join("bin")
            .join("python");
        if migration_venv.exists() {
            return migration_venv.to_string_lossy().into_owned();
        }
    }
    let candidates = [
        "/opt/homebrew/bin/python3.11",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3.11",
        "/usr/local/bin/python3",
        "python.exe",
        "python3",
        "python",
    ];
    for c in candidates {
        if Command::new(c).arg("--version").output().is_ok() {
            return c.to_string();
        }
    }
    "python3".to_string()
}

fn runtime_dirs(app: &AppHandle) -> Option<RuntimeDirs> {
    let app_data = app.path().app_data_dir().ok()?;
    let models = app_data.join("models");
    let outputs = app_data.join("outputs");
    let cache = app_data.join("cache");
    let temp = cache.join("temp");
    let uploads = cache.join("uploads");
    let switch_state = app_data.join("switch_states.json");

    for dir in [&app_data, &models, &outputs, &cache, &temp, &uploads] {
        if let Err(err) = fs::create_dir_all(dir) {
            eprintln!(
                "[deep-face-cam] WARN: failed to create runtime dir '{}': {}",
                dir.display(),
                err
            );
            return None;
        }
    }

    Some(RuntimeDirs {
        app_data,
        models,
        outputs,
        cache,
        temp,
        uploads,
        switch_state,
    })
}

fn apply_runtime_env(
    command: &mut Command,
    runtime: Option<&RuntimeDirs>,
    source_models_available: bool,
) {
    if let Some(paths) = runtime {
        if env::var_os("DEEPFACECAM_DATA_DIR").is_none() {
            command.env("DEEPFACECAM_DATA_DIR", &paths.app_data);
        }
        if env::var_os("DEEPFACECAM_MODELS_DIR").is_none() && !source_models_available {
            command.env("DEEPFACECAM_MODELS_DIR", &paths.models);
        }
        if env::var_os("DEEPFACECAM_OUTPUTS_DIR").is_none() {
            command.env("DEEPFACECAM_OUTPUTS_DIR", &paths.outputs);
        }
        if env::var_os("DEEPFACECAM_CACHE_DIR").is_none() {
            command.env("DEEPFACECAM_CACHE_DIR", &paths.cache);
        }
        if env::var_os("DEEPFACECAM_TEMP_DIR").is_none() {
            command.env("DEEPFACECAM_TEMP_DIR", &paths.temp);
        }
        if env::var_os("DEEPFACECAM_UPLOADS_DIR").is_none() {
            command.env("DEEPFACECAM_UPLOADS_DIR", &paths.uploads);
        }
        if env::var_os("DEEPFACECAM_SWITCH_STATE_PATH").is_none() {
            command.env("DEEPFACECAM_SWITCH_STATE_PATH", &paths.switch_state);
        }
    }
}

fn spawn_backend(app: &AppHandle) -> Option<Child> {
    let runtime = runtime_dirs(app);
    if let Some(sidecar) = find_bundled_backend(app) {
        eprintln!(
            "[deep-face-cam] launching bundled backend sidecar: '{}'",
            sidecar.display()
        );
        let mut command = Command::new(&sidecar);
        command
            .arg("--port")
            .arg("8765")
            .env("OPENCV_AVFOUNDATION_SKIP_AUTH", "1")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());
        if let Some(parent) = sidecar.parent() {
            command.current_dir(parent);
        }
        apply_runtime_env(&mut command, runtime.as_ref(), false);
        return command.spawn().ok();
    }

    let root = find_backend_root(Some(app))?;
    let py = find_python(&root);
    let source_models_available = root.join("models").join("inswapper_128.onnx").exists();
    eprintln!(
        "[deep-face-cam] launching backend: python='{}' cwd='{}'",
        py,
        root.display()
    );
    let mut command = Command::new(py);
    command
        .arg("-m")
        .arg("modules.backend_server")
        .arg("--port")
        .arg("8765")
        .current_dir(&root)
        .env("OPENCV_AVFOUNDATION_SKIP_AUTH", "1")
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    apply_runtime_env(&mut command, runtime.as_ref(), source_models_available);

    command.spawn().ok()
}

#[tauri::command]
fn backend_status(state: tauri::State<'_, BackendHandle>) -> serde_json::Value {
    let mut guard = state.0.lock().unwrap();
    match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(Some(status)) => serde_json::json!({
                "running": false,
                "exit": status.code(),
            }),
            Ok(None) => serde_json::json!({ "running": true }),
            Err(e) => serde_json::json!({ "running": false, "error": e.to_string() }),
        },
        None => serde_json::json!({ "running": false, "spawned": false }),
    }
}

#[tauri::command]
fn restart_backend(app: AppHandle, state: tauri::State<'_, BackendHandle>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
    }
    *guard = spawn_backend(&app);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendHandle(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![backend_status, restart_backend])
        .setup(|app| {
            let state = app.state::<BackendHandle>();
            let app_handle = app.handle().clone();
            let child = spawn_backend(&app_handle);
            if child.is_none() {
                eprintln!(
                    "[deep-face-cam] WARN: backend not spawned. \
                     Set DEEPFACECAM_DLC to the backend folder, \
                     or run `python -m modules.backend_server` yourself."
                );
            }
            *state.0.lock().unwrap() = child;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<BackendHandle>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
