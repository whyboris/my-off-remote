use axum::{
    extract::State,
    routing::{get, post},
    Router,
};
use system_uptime::get_os_uptime_duration;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

struct AppState {
    shutdown_tx: broadcast::Sender<()>,
}

#[tauri::command]
async fn please_start_server(port: u16) -> String {
    let static_files_service = ServeDir::new("public");

    let (shutdown_tx, _) = broadcast::channel(1);
    let app_state = std::sync::Arc::new(AppState { shutdown_tx });

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/off", post(trigger_server_shutdown))
        .route("/off", get(shutdown_computer))
        // .route("/", get(|| async { "Hello World" }))
        .fallback_service(ServeDir::new("assets"))
        .nest_service("/static", static_files_service)
        .layer(cors)
        .with_state(app_state.clone());

    match TcpListener::bind(format!("{}{}", "0.0.0.0:", port)).await {
        Ok(listener) => {
            println!("Listening on: {}", listener.local_addr().unwrap());

            let shutdown_rx = app_state.shutdown_tx.subscribe();

            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let mut rx = shutdown_rx;
                    let _ = rx.recv().await;
                    println!("Shutdown signal received!");
                })
                .await
                .unwrap(); // runs forever

            println!("server just shut down!");

            format!("server is off") // hardcoded value expected on front end verbatim!
        }
        Err(e) => {
            format!("error: {}", e)
        }
    }
}

async fn trigger_server_shutdown(State(state): State<std::sync::Arc<AppState>>) -> &'static str {
    println!("Initiating shutdown from /trigger-shutdown endpoint...");
    let _ = state.shutdown_tx.send(());
    "Shutdown initiated. Server will now drain active connections."
}

async fn shutdown_computer() -> &'static str {

    // if windows
    let _ = shutdown_windows_now();
    // if mac - not yet implemented

    "shutting down your computer..."
}

fn shutdown_windows_now() -> Result<(), String> {
    // Execute: shutdown /s /t 0 (shutdown immediately)
    std::process::Command::new("shutdown")
        .args(["/s", "/t", "0"])
        .output()
        .map_err(|e| format!("Failed to execute shutdown: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_uptime() -> Option<u64> {
    match get_os_uptime_duration() {
        Ok(uptime) => Some(uptime.as_secs()),
        Err(e) => {
            eprintln!("Failed to get uptime: {}", e);
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_device_info::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![
            get_uptime,
            please_start_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
