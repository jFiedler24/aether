// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// [impl->feat~tauri-desktop-shell~1]
// [impl->feat~windows-primary-target~1]
mod history;
mod profiles;
mod remote_edit;
mod sftp;
mod ssh;
mod terminal;

fn main() {
    // [impl->feat~tauri-desktop-shell~1]
    // [impl->feat~pitfalls-and-constraints~1]
    // [impl->req~async-commands-no-block~1]
    // [impl->req~windows-installer~1]
    // [impl->req~windows-openssh-detection~1]
    // [impl->req~temp-file-cleanup~1]
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // [impl->req~windows-webview-clipboard~1]
        .plugin(tauri_plugin_clipboard_manager::init())
        // [impl->feat~connection-profiles~1]
        .invoke_handler(tauri::generate_handler![
            history::list_history,
            history::clear_history,
            profiles::list_profiles,
            profiles::save_profile,
            profiles::delete_profile,
            // [impl->feat~ssh-terminal~1]
            ssh::connect,
            ssh::disconnect,
            ssh::send_data,
            // [impl->feat~remote-file-browser~1]
            sftp::list_directory,
            sftp::read_file,
            sftp::write_file,
            // [impl->feat~file-association-tool-mapping~1]
            remote_edit::open_remote_file,
            remote_edit::unwatch_remote_file,
            remote_edit::list_watched_files,
            // [impl->req~terminal-log-save~1]
            terminal::save_log_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
