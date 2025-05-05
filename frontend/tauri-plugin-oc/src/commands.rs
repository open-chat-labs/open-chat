use tauri::{AppHandle, Runtime, command};

use crate::OcExt;
use crate::Result;
use crate::models::*;

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
