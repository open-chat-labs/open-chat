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
    #[cfg(mobile)]
    app.oc().restart_app();
    #[cfg(not(mobile))]
    app.restart();
}

#[command]
pub(crate) async fn load_recent_media<R: Runtime>(
    app: AppHandle<R>,
    payload: LoadRecentMediaRequest,
) -> Result<LoadRecentMediaResponse> {
    app.oc().load_recent_media(payload)
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

    Ok(did_download)
}

#[command]
pub(crate) async fn enable_viewport_resize<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.oc().toggle_viewport_resize(true)
}

#[command]
pub(crate) async fn disable_viewport_resize<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.oc().toggle_viewport_resize(false)
}

// This command is only used to save files to local public storage.
//
// Note: this command is not handled by kotlin code.

#[command]
pub(crate) async fn save_media<R: Runtime>(
    _app: AppHandle<R>,
    payload: SaveMediaRequest,
) -> Result<()> {
    let SaveMediaRequest {
        kind,
        filename,
        data,
        mime_type,
    } = payload;

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let _ = (&kind, &filename, &data, &mime_type);

    #[cfg(target_os = "android")]
    {
        use tauri_plugin_android_fs::{
            AndroidFsExt, PublicDir, PublicGeneralPurposeDir, PublicImageDir, PublicVideoDir,
        };
        let api = _app.android_fs_async();
        let storage = api.public_storage();

        storage.request_permission().await?;

        let pub_dir = match kind.as_str() {
            "image" => PublicDir::Image(PublicImageDir::Pictures),
            "video" => PublicDir::Video(PublicVideoDir::Movies),
            _ => PublicDir::GeneralPurpose(PublicGeneralPurposeDir::Download),
        };

        println!("OC_LOG: Download file: {:?}, {:?}", pub_dir, filename);

        let mime = (!mime_type.trim().is_empty()).then_some(mime_type.as_str());

        storage
            .write_new(None, pub_dir, &filename, mime, &data)
            .await?;
    }

    // iOS saves to app's sandbox, to save to public camera roll we need to use
    // Photos framework on the Swift side, and add NSPhotoLibraryAddUsageDescription
    // to Info.plist
    #[cfg(target_os = "ios")]
    {
        use std::path::Path;
        use tokio::fs;

        let safe_filename = Path::new(&filename)
            .file_name()
            .ok_or_else(|| crate::Error::IOSInvalidFileName)?;

        let base_dir = _app.path().document_dir()?;
        let sub_dir = match kind.as_str() {
            "image" => base_dir.join("Pictures"),
            "video" => base_dir.join("Videos"),
            _ => base_dir.clone(),
        };

        // create_dir_all is idempotent
        fs::create_dir_all(&sub_dir).await?;

        let file_path = sub_dir.join(safe_filename);
        fs::write(&file_path, &data).await?;
    }

    Ok(())
}
