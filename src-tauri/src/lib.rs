use system_uptime::get_os_uptime_duration;
use axum::{routing::get, Router};
use tower_http::services::ServeDir;

async fn start_my_server() {

    let static_files_service = ServeDir::new("public");

    let app = Router::new()
        .route("/", get(|| async { "Hello World" }))
        .fallback_service(ServeDir::new("assets"))
        .nest_service("/static", static_files_service);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    println!("Listening on: {}", listener.local_addr().unwrap());

    // Axum server runs here
    axum::serve(listener, app).await.unwrap();
}

fn get_uptime() {
    match get_os_uptime_duration() {
        Ok(uptime) => {
            let days = uptime.as_secs() / 86400;
            let hours = (uptime.as_secs() % 86400) / 3600;
            let minutes = (uptime.as_secs() % 3600) / 60;
            let seconds = uptime.as_secs() % 60;

            println!("System Uptime: {}d {}h {}m {}s", days, hours, minutes, seconds);
        }
        Err(e) => eprintln!("Failed to get uptime: {}", e),
    }
}

#[tauri::command]
fn shutdown_windows() -> Result<(), String> {
    // Execute: shutdown /s /t 0 (shutdown immediately)
    std::process::Command::new("shutdown")
        .args(["/s", "/t", "0"])
        .output()
        .map_err(|e| format!("Failed to execute shutdown: {}", e))?;
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {

    let _ = get_uptime();

    format!("Hello, {}! You've been greeted from Rust!", name)
}


#[tauri::command]
async fn please_start_server(payload: String) -> Result<String, String> {

    start_my_server().await;

    // Perform async I/O or network requests
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    Ok(format!("Processed: {}", payload))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, shutdown_windows, please_start_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
