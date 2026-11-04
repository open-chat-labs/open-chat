use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_turnstile_config)]
#[derive(Serialize, Deserialize)]
pub struct Args {
    // Cloudflare Turnstile's secret key for the website's widget. Without it, prize claims aren't
    // checked for a human.
    pub secret_key: Option<String>,
    // Whether a prize claim must carry a token. Until then a claim with one is still checked.
    pub required: bool,
}

// Written by hand so that `#[trace]` doesn't record the key
impl std::fmt::Debug for Args {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("secret_key_set", &self.secret_key.is_some())
            .field("required", &self.required)
            .finish()
    }
}

pub type Response = UnitResult;
