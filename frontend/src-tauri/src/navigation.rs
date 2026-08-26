use tauri::async_runtime;
use tauri::{AppHandle, Url};
use tauri_plugin_oc::{OcExt, OpenUrlRequest};

// TODO rewrite remote oc.app urls for nav locally!

// Handle webview navigation!
//
// Handles webview URL changes, and returns true or false if the navigation
// should proceed.
pub fn mobile_on_navigation_handler(app_handle: &AppHandle, url: &Url) -> bool {
    let url_str = url.to_string();

    // Check if the nav url is local tauri domain!
    if is_allowed_url(app_handle, &url_str) {
        return true;
    }

    let app_handle = app_handle.clone();

    // Url is not allowed for navigation in webview, so we send an open_url
    // command to the native layer, which will then handle it appropriately.
    async_runtime::spawn(async move {
        let req = OpenUrlRequest { url: url_str };
        let res = app_handle.oc().open_url(req);
        if let Err(err) = res {
            eprintln!("ERROR OPENING URL: {:#?}", err);
        }
    });

    // URL is allowed and we continue navigation!
    false
}

// Check URL
//
// Only allow URLs that should be handled by the webview. If not, then either
// an external app or a browser should be used.
fn is_allowed_url(app_handle: &AppHandle, url_str: &str) -> bool {
    let Ok(url) = Url::parse(url_str) else {
        // URL is invalid!
        return false;
    };

    // iOS serves the bundled app from the custom scheme itself
    // (tauri://localhost), where Android uses http://tauri.localhost.
    if url.scheme() == "tauri" {
        return true;
    }

    let host = match url.host_str() {
        Some(h) => h.to_lowercase(),
        None => return false,
    };

    // In debug the webview loads the vite dev server (and iOS invokes this
    // handler for the initial load too), so its host must be navigable.
    #[cfg(debug_assertions)]
    if let Some(dev_url) = &app_handle.config().build.dev_url
        && dev_url
            .host_str()
            .is_some_and(|dev_host| dev_host.eq_ignore_ascii_case(&host))
    {
        return true;
    }
    #[cfg(not(debug_assertions))]
    let _ = app_handle;

    // We only allow local webview navigation, everything else must open an
    // external app or a browser.
    host == "tauri.localhost"
}
