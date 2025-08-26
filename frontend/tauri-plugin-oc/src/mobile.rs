use serde::de::DeserializeOwned;
use tauri::{
    AppHandle, Runtime,
    plugin::{PluginApi, PluginHandle},
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_oc);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Oc<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.ocplugin.app", "OpenChatPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_oc)?;
    Ok(Oc(handle))
}

/// Access to the oc APIs.
pub struct Oc<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Oc<R> {
    pub fn open_url(&self, payload: OpenUrlRequest) -> crate::Result<OpenUrlResponse> {
        self.0
            .run_mobile_plugin("openUrl", payload)
            .map_err(Into::into)
    }

    pub fn sign_up(&self, payload: SignUpRequest) -> crate::Result<SignUpResponse> {
        self.0
            .run_mobile_plugin("signUp", payload)
            .map_err(Into::into)
    }

    pub fn sign_in(&self, payload: SignInRequest) -> crate::Result<SignInResponse> {
        self.0
            .run_mobile_plugin("signIn", payload)
            .map_err(Into::into)
    }

    pub fn show_notification(&self, payload: ShowNotificationRequest) {
        let _: Result<(), _> = self.0.run_mobile_plugin("showNotification", payload);
    }

    // SvelteReadyRequest is just a placeholder type simply required as the
    // second arg to the run_mobile_plugin function.
    pub fn svelte_ready(&self) {
        let _: Result<(), _> = self
            .0
            .run_mobile_plugin("svelteReady", SvelteReadyRequest::default());
    }
}
