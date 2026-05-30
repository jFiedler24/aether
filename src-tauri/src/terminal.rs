use tauri::command;
use tauri_plugin_dialog::DialogExt;

// [impl->feat~ssh-terminal~1]
// [impl->req~terminal-log-save~1]
#[command]
pub fn save_log_dialog(
    data: String,
    default_name: String,
    window: tauri::Window,
) -> Result<(), String> {
    let path = window
        .dialog()
        .file()
        .set_parent(&window)
        .set_file_name(&default_name)
        .add_filter("Log files", &["log", "txt"])
        .blocking_save_file()
        .ok_or("Save cancelled")?;

    let p = path.as_path().ok_or("Invalid file path")?;
    std::fs::write(p, data).map_err(|e| e.to_string())?;
    Ok(())
}
