use oc_error_codes::OCErrorCode;
use types::OCResult;
use url::Url;

// A channel's external_url is rendered by the website inside an <iframe>. Only https is
// accepted: `javascript:` would run in the app's own origin, `data:`/`blob:` bypass the
// frame-src allowlist, and http would be mixed content.
pub fn validate_external_url(external_url: &str) -> OCResult<()> {
    match Url::parse(external_url) {
        Ok(url) if url.scheme() == "https" => Ok(()),
        _ => Err(OCErrorCode::InvalidExternalUrl.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Invariant: the community canister only stores https external URLs.
    #[test]
    fn https_url_is_accepted() {
        assert!(validate_external_url("https://example.com/app?x=1").is_ok());
    }

    // Invariant: the community canister only stores https external URLs.
    #[test]
    fn non_https_schemes_are_rejected() {
        for url in [
            "http://example.com",
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "blob:https://oc.app/abc",
            "ftp://example.com",
            "//example.com",
            "example.com",
            "",
        ] {
            let err = validate_external_url(url).unwrap_err();
            assert_eq!(err.code(), OCErrorCode::InvalidExternalUrl as u16, "{url}");
        }
    }
}
