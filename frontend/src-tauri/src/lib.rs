use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, Shortcut, ShortcutState};

pub mod commands;
pub mod hardware_codecs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            commands::platform::probe_platform,
            commands::platform::update_media_metadata,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let play_pause_shortcut = Shortcut::new(None, Code::MediaPlayPause);
            let next_shortcut = Shortcut::new(None, Code::MediaTrackNext);
            let prev_shortcut = Shortcut::new(None, Code::MediaTrackPrevious);

            // Best-effort media-key shortcut registration.
            // If the OS denies/blocks media-key event watching, we log and continue startup
            // (tray/menu still works, and the app won't crash).
            let shortcut_plugin_result: Result<_, tauri::Error> = (|| {
                let plugin = tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts([play_pause_shortcut, next_shortcut, prev_shortcut])
                    .map_err(|e| tauri::Error::from(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?
                    .with_handler(move |app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if shortcut == &play_pause_shortcut {
                                let _ = app.emit("tray-play-pause", ());
                            } else if shortcut == &next_shortcut {
                                let _ = app.emit("tray-next", ());
                            } else if shortcut == &prev_shortcut {
                                let _ = app.emit("tray-prev", ());
                            }
                        }
                    })
                    .build();

                Ok::<_, tauri::Error>(app.handle().plugin(plugin)?)
            })();

            if let Err(e) = shortcut_plugin_result {
                log::warn!(
                    "global-shortcut plugin failed to initialize (media key watching disabled): {e}"
                );
            }


            let quit_i = MenuItem::with_id(app, "quit", "Quit Zovyra", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let play_i = MenuItem::with_id(app, "play", "Play / Pause", true, None::<&str>)?;
            let next_i = MenuItem::with_id(app, "next", "Next Track", true, None::<&str>)?;
            let prev_i = MenuItem::with_id(app, "prev", "Previous Track", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&show_i, &play_i, &next_i, &prev_i, &quit_i],
            )?;

            let mut tray_builder = TrayIconBuilder::with_id("main").menu(&menu);

            // `default_window_icon()` can return None for an unbundled dev
            // binary on some platforms (notably `tauri dev` on macOS, where
            // the icon isn't attached the way it would be in a finished
            // .app bundle or via Windows' PE resource embedding). Falling
            // back to no icon avoids an unwrap panic that previously
            // aborted startup before the window ever appeared.
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            } else {
                log::warn!("no default window icon available; tray icon will use the platform default");
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "play" => {
                        let _ = app.emit("tray-play-pause", ());
                    }
                    "next" => {
                        let _ = app.emit("tray-next", ());
                    }
                    "prev" => {
                        let _ = app.emit("tray-prev", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
}
