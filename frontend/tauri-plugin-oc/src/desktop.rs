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

impl<R: Runtime> Oc<R> {
    pub fn open_url(&self, _payload: OpenUrlRequest) -> crate::Result<OpenUrlResponse> {
        unimplemented!("not implemented for desktop environment")
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
}
