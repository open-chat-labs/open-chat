use tauri::{AppHandle, Runtime, command};

use crate::OcExt;
use crate::Result;
use crate::models::*;
use crate::update_manager;

#[command]
pub(crate) async fn open_url<R: Runtime>(
    app: AppHandle<R>,
    payload: OpenUrlRequest,
) -> Result<OpenUrlResponse> {
    app.oc().open_url(payload)
}

#[command]
pub(crate) async fn sign_up<R: Runtime>(
    app: AppHandle<R>,
    payload: SignUpRequest,
) -> Result<SignUpResponse> {
    app.oc().sign_up(payload)
}

#[command]
pub(crate) async fn sign_in<R: Runtime>(
    app: AppHandle<R>,
    payload: SignInRequest,
) -> Result<SignInResponse> {
    app.oc().sign_in(payload)
}

#[command]
pub(crate) async fn show_notification<R: Runtime>(
    app: AppHandle<R>,
    payload: ShowNotificationRequest,
) {
    app.oc().show_notification(payload)
}

#[command]
pub(crate) async fn svelte_ready<R: Runtime>(app: AppHandle<R>) {
    app.oc().svelte_ready()
}

#[command]
pub(crate) async fn release_notifications<R: Runtime>(
    app: AppHandle<R>,
    payload: ReleaseNotificationsRequest,
) {
    app.oc().release_notifications(payload)
}

#[command]
pub(crate) async fn minimize_app<R: Runtime>(app: AppHandle<R>) {
    app.oc().minimize_app()
}

#[command]
pub(crate) async fn restart_app<R: Runtime>(app: AppHandle<R>) {
    app.restart();
}

#[command]
pub(crate) async fn get_server_version<R: Runtime>(
    app: AppHandle<R>,
) -> std::result::Result<String, String> {
    let manager = update_manager::UpdateManager::new(app);
    manager
        .get_server_version()
        .await
        .map(|v| v.to_string())
        .map_err(|e| e.to_string())
}

#[command]
pub(crate) async fn download_update<R: Runtime>(
    app: AppHandle<R>,
) -> std::result::Result<bool, String> {
    let manager = update_manager::UpdateManager::new(app.clone());
    let did_download = manager
        .check_for_updates()
        .await
        .map_err(|e| e.to_string())?;

    if did_download {
        return Ok(true);
    }

    let bundled = manager
        .get_bundled_version()
        .unwrap_or_else(|| semver::Version::parse("0.0.0").unwrap());
    let cached = manager
        .get_cached_version()
        .unwrap_or_else(|| semver::Version::parse("0.0.0").unwrap());

    if cached > bundled {
        return Ok(true);
    }

    Ok(false)
}
