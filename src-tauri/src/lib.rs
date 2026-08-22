use tauri::Manager;

#[tauri::command]
async fn select_folder() -> Result<String, String> {
    let folder = rfd::AsyncFileDialog::new()
        .pick_folder()
        .await
        .ok_or("未选择目录")?;
    
    Ok(folder.path().to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![select_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}