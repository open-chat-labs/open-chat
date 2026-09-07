use serde::de::DeserializeOwned;
use tauri::{AppHandle, Runtime, plugin::PluginApi};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Oc<R>> {
    Ok(Oc(app.clone()))
}

/// Access to the oc APIs.
pub struct Oc<R: Runtime>(AppHandle<R>);

fn open_url_with<E>(
    url: &str,
    open_url: impl FnOnce(&str) -> std::result::Result<(), E>,
) -> OpenUrlResponse {
    // Opening an external handler is best-effort. The desktop shell has no useful recovery UI if
    // the operating system has no handler, and the web caller already treats the command as a
    // fire-and-forget handoff.
    let _ = open_url(url);
    OpenUrlResponse::default()
}

impl<R: Runtime> Oc<R> {
    pub fn open_url(&self, payload: OpenUrlRequest) -> crate::Result<OpenUrlResponse> {
        Ok(open_url_with(&payload.url, |url| open::that_detached(url)))
    }

    pub fn sign_up(&self, _payload: SignUpRequest) -> crate::Result<SignUpResponse> {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn sign_in(&self, _payload: SignInRequest) -> crate::Result<SignInResponse> {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn show_notification(&self, _payload: ShowNotificationRequest) {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn svelte_ready(&self) {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn minimize_app(&self) {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn release_notifications(&self, _payload: ReleaseNotificationsRequest) {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn load_recent_media(
        &self,
        _payload: LoadRecentMediaRequest,
    ) -> crate::Result<LoadRecentMediaResponse> {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn toggle_viewport_resize(&self, _toggle: bool) -> crate::Result<()> {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn export_media(&self, _payload: ExportMediaRequest) -> crate::Result<ExportMediaResponse> {
        unimplemented!("not implemented for desktop environment")
    }

    pub fn update_chat_shortcuts(
        &self,
        _payload: UpdateChatShortcutsRequest,
    ) -> crate::Result<UpdateChatShortcutsResponse> {
        unimplemented!("not implemented for desktop environment")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_url_bridge_passes_the_exact_url_to_the_os_opener() {
        let url = "https://example.com/settings#opaque-fragment";
        let mut opened = None;

        let response = open_url_with(url, |actual| {
            opened = Some(actual.to_owned());
            Ok::<(), ()>(())
        });

        assert_eq!(opened.as_deref(), Some(url));
        assert_eq!(response.value, None);
    }

    #[test]
    fn desktop_url_bridge_is_best_effort_when_the_os_opener_fails() {
        let response = open_url_with("https://example.com/", |_| Err::<(), _>("blocked"));

        assert_eq!(response.value, None);
    }
}
