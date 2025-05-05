use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

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
        Ok(OpenUrlResponse {
            value: Some("not implemented for desktop environment".to_string()),
        })
    }

    pub fn sign_up(&self, _payload: SignUpRequest) -> crate::Result<SignUpResponse> {
        // NOTE: this is not implemented due to this being the desktop version
        // of the plugin, which we do not support.
        Ok(SignUpResponse { passkey: "".into() })
    }

    pub fn sign_in(&self, _payload: SignInRequest) -> crate::Result<SignInResponse> {
        // NOTE: this is not implemented due to this being the desktop version
        // of the plugin, which we do not support.
        Ok(SignInResponse { passkey: "".into() })
    }
}
