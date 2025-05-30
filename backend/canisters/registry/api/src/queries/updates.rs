use crate::{MessageFilterSummary, NervousSystemSummary, TokenDetails};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AirdropConfig, CanisterId, ExchangeId, OptionUpdate, TimestampMillis};

#[ts_export(registry, updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub since: Option<TimestampMillis>,
}

#[ts_export(registry, updates)]
#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(registry, updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub token_details: Option<Vec<TokenDetails>>,
    #[ts(as = "Option::<Vec::<ts_export::TSPrincipal>>")]
    pub tokens_uninstalled: Option<Vec<CanisterId>>,
    pub nervous_system_details: Vec<NervousSystemSummary>,
    pub message_filters_added: Vec<MessageFilterSummary>,
    pub message_filters_removed: Vec<u64>,
    pub swap_providers: Option<Vec<ExchangeId>>,
    #[ts(as = "types::OptionUpdateAirdropConfig")]
    pub airdrop_config: OptionUpdate<AirdropConfig>,
}
