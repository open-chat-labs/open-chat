use crate::guards::caller_is_governance_principal;
use crate::metadata_helper::MetadataHelper;
use crate::{mutate_state, read_state};
use candid::Principal;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use constants::{MEMO_LIST_TOKEN, SNS_GOVERNANCE_CANISTER_ID};
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use registry_canister::add_token::{Response::*, *};
use registry_canister::{NervousSystemDetails, Payment};
use tracing::{error, info};
use types::{CanisterId, Cryptocurrency, UserId};

const TOKEN_LISTING_FEE_E8S: u128 = 50_000_000_000; // 500 CHAT

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    add_token_impl(
        args.ledger_canister_id,
        args.payer,
        None,
        Some(args.info_url),
        Some(args.how_to_buy_url),
        Some(args.transaction_url_format),
        args.logo,
    )
    .await
}

pub(crate) async fn add_sns_token(nervous_system: NervousSystemDetails) {
    add_token_impl(
        nervous_system.ledger_canister_id,
        None,
        Some(nervous_system),
        None,
        None,
        None,
        None,
    )
    .await;
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn add_token_impl(
    ledger_canister_id: CanisterId,
    payer: Option<UserId>,
    nervous_system: Option<NervousSystemDetails>,
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    logo: Option<String>,
) -> Response {
    let metadata = match icrc_ledger_canister_c2c_client::icrc1_metadata(ledger_canister_id).await {
        Ok(r) => r,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let metadata_helper = match MetadataHelper::try_parse(metadata) {
        Ok(h) => h,
        Err(reason) => return InvalidRequest(format!("Token metadata is incomplete: {reason}")),
    };

    if !metadata_helper.is_icrc1_compatible() {
        return InvalidRequest("Token is not compatible with the ICRC1 standard".to_string());
    }

    let Urls {
        info_url,
        how_to_buy_url,
        transaction_url_format,
    } = match extract_urls(info_url, how_to_buy_url, transaction_url_format, nervous_system.as_ref()) {
        Ok(urls) => urls,
        Err(error) => {
            error!(%ledger_canister_id, error);
            return InvalidRequest(error.to_string());
        }
    };

    let Some(logo) = metadata_helper
        .logo()
        .cloned()
        .or(logo)
        .or(nervous_system.as_ref().map(|ns| ns.logo.clone()))
    else {
        let error = "Failed to find logo for token";
        error!(%ledger_canister_id, error);
        return InternalError(error.to_string());
    };

    let standards = match icrc_ledger_canister_c2c_client::icrc1_supported_standards(ledger_canister_id).await {
        Ok(standards) => standards,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    let (test_mode, now_nanos, exists) = read_state(|state| {
        (
            state.data.test_mode,
            state.env.now_nanos(),
            state.data.tokens.exists(ledger_canister_id),
        )
    });

    if exists {
        return AlreadyAdded;
    }

    // Transfer the listing fee from the payer to the BURN address
    let mut payment: Option<Payment> = None;
    if let Some(user_id) = payer {
        let amount = if test_mode { 100_000_000 } else { TOKEN_LISTING_FEE_E8S };
        let from: Principal = user_id.into();
        let transfer_args = TransferFromArgs {
            spender_subaccount: None,
            from: from.into(),
            to: SNS_GOVERNANCE_CANISTER_ID.into(),
            amount: amount.into(),
            fee: None, // No transfer fee for BURNing
            memo: Some(MEMO_LIST_TOKEN.to_vec().into()),
            created_at_time: Some(now_nanos),
        };

        match icrc2_transfer_from(Cryptocurrency::CHAT.ledger_canister_id().unwrap(), &transfer_args).await {
            Ok(block_index) => {
                payment = Some(Payment {
                    amount,
                    block_index,
                    timestamp: now_nanos / 1000,
                    user_id,
                });
            }
            Err(message) => {
                error!(%user_id, ?message, "Error transferring listing fee");
                return PaymentFailed(message.to_string());
            }
        }
    }

    mutate_state(|state| {
        let now = state.env.now();
        let standards = standards.into_iter().map(|r| r.name).collect();

        if let Some(ns) = nervous_system {
            state.data.nervous_systems.add(ns, now);
        }

        let name = metadata_helper.name().to_string();
        state.data.tokens.add(
            ledger_canister_id,
            name.clone(),
            metadata_helper.symbol().to_string(),
            metadata_helper.decimals(),
            metadata_helper.fee(),
            logo,
            info_url,
            how_to_buy_url,
            transaction_url_format,
            standards,
            payment,
            now,
        );
        info!(name, %ledger_canister_id, "Token added");
    });

    Success
}

struct Urls {
    info_url: String,
    how_to_buy_url: String,
    transaction_url_format: String,
}

fn extract_urls(
    info_url: Option<String>,
    how_to_buy_url: Option<String>,
    transaction_url_format: Option<String>,
    nervous_system: Option<&NervousSystemDetails>,
) -> Result<Urls, &'static str> {
    let info_url = match info_url.or_else(|| {
        nervous_system
            .as_ref()
            .map(|ns| ns.root_canister_id)
            .map(|c| format!("https://dashboard.internetcomputer.org/sns/{c}"))
    }) {
        Some(url) => url,
        _ => return Err("'info_url' must be provided for non-SNS tokens"),
    };

    let how_to_buy_url = match how_to_buy_url.or_else(|| {
        nervous_system
            .as_ref()
            .is_some_and(|ns| !ns.is_nns)
            .then_some("https://3ezrj-4yaaa-aaaam-abcha-cai.ic0.app/sns/faq#how-can-i-get-sns-tokens".to_string())
    }) {
        Some(url) => url,
        _ => return Err("'how_to_buy_url' must be provided for non-SNS tokens"),
    };

    let transaction_url_format = match transaction_url_format.or_else(|| {
        nervous_system
            .as_ref()
            .filter(|ns| !ns.is_nns)
            .map(|ns| ns.root_canister_id)
            .map(|c| format!("https://dashboard.internetcomputer.org/sns/{c}/transaction/{{transaction_index}}"))
    }) {
        Some(url) => url,
        _ => return Err("'transaction_url_format' must be provided for non-SNS tokens"),
    };

    Ok(Urls {
        info_url,
        how_to_buy_url,
        transaction_url_format,
    })
}

async fn icrc2_transfer_from(ledger_canister_id: CanisterId, transfer_args: &TransferFromArgs) -> Result<u64, String> {
    match icrc_ledger_canister_c2c_client::icrc2_transfer_from(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => Ok(block_index.0.try_into().unwrap()),
        Ok(Err(err)) => Err(format!("Error calling 'icrc2_transfer_from': {err:?}")),
        Err(error) => Err(format!("IC error calling 'icrc2_transfer_from': {error:?}")),
    }
}
