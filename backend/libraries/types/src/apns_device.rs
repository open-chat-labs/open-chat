use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

/// The prefix a development build puts on its tokens, so the pusher sends them to the APNs
/// sandbox. The canisters treat the whole string as opaque.
pub const APNS_SANDBOX_PREFIX: &str = "sandbox:";

/// An APNs device token as hex, with `sandbox:` in front when the build that registered it
/// talks to the APNs sandbox.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub struct ApnsToken(pub String);

impl ApnsToken {
    pub fn is_sandbox(&self) -> bool {
        self.0.starts_with(APNS_SANDBOX_PREFIX)
    }

    /// The token as APNs knows it, without the sandbox prefix
    pub fn device_token(&self) -> &str {
        self.0.strip_prefix(APNS_SANDBOX_PREFIX).unwrap_or(&self.0)
    }
}

impl From<String> for ApnsToken {
    fn from(token: String) -> Self {
        ApnsToken(token)
    }
}

/// One iOS install: the token for alert pushes and, once the app registers with PushKit, the
/// token for VoIP pushes. Either may be missing, but a device always holds at least one.
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub struct ApnsDevice {
    pub alert_token: Option<ApnsToken>,
    pub voip_token: Option<ApnsToken>,
}

impl ApnsDevice {
    pub fn tokens(&self) -> impl Iterator<Item = &ApnsToken> {
        self.alert_token.iter().chain(self.voip_token.iter())
    }

    pub fn holds(&self, token: &ApnsToken) -> bool {
        self.tokens().any(|t| t == token)
    }

    pub fn shares_a_token_with(&self, other: &ApnsDevice) -> bool {
        other.tokens().any(|t| self.holds(t))
    }

    pub fn is_empty(&self) -> bool {
        self.alert_token.is_none() && self.voip_token.is_none()
    }

    pub fn approx_size(&self) -> usize {
        self.tokens().map(|t| t.0.len() + 8).sum::<usize>() + 8
    }
}
