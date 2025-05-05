use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Oc;
#[cfg(mobile)]
use mobile::Oc;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the oc APIs.
pub trait OcExt<R: Runtime> {
    fn oc(&self) -> &Oc<R>;
}

impl<R: Runtime, T: Manager<R>> crate::OcExt<R> for T {
    fn oc(&self) -> &Oc<R> {
        self.state::<Oc<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("oc")
        .invoke_handler(tauri::generate_handler![
            commands::open_url,
            commands::sign_up,
            commands::sign_in
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let oc = mobile::init(app, api)?;
            #[cfg(desktop)]
            let oc = desktop::init(app, api)?;
            app.manage(oc);
            Ok(())
        })
        .build()
}
