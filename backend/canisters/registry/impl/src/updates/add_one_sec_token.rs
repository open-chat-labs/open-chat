use crate::read_state;
use crate::updates::add_token::add_token_impl;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::ONE_SEC_MINTER_CANISTER_ID;
use oc_error_codes::OCErrorCode;
use one_sec_minter_canister::Token;
use registry_canister::add_one_sec_token::*;
use std::str::FromStr;
use types::{CanisterId, Chain, EvmContractAddress, OCResult};

#[update(msgpack = true)]
#[trace]
async fn add_one_sec_token(args: Args) -> Response {
    add_one_sec_token_impl(args).await.into()
}

async fn add_one_sec_token_impl(args: Args) -> OCResult {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    if user_index_canister_c2c_client::lookup_user(caller, user_index_canister_id)
        .await?
        .is_none_or(|u| !u.is_platform_operator)
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    let token = Token::from_str(&args.token).map_err(|_| OCErrorCode::CurrencyNotSupported)?;

    let metadata = one_sec_minter_canister_c2c_client::get_metadata(ONE_SEC_MINTER_CANISTER_ID)
        .await?
        .map_err(|error| OCErrorCode::Unknown.with_message(error))?;

    let token_metadata: Vec<_> = metadata
        .tokens
        .into_iter()
        .filter(|tm| tm.token.is_some_and(|t| t == token))
        .collect();

    let Some(ledger_canister_id) = token_metadata
        .iter()
        .find(|tm| tm.chain.is_some_and(|c| c == Chain::ICP))
        .and_then(|tm| CanisterId::from_text(&tm.contract).ok())
    else {
        return Err(OCErrorCode::LedgerNotFound.into());
    };

    let evm_contract_addresses: Vec<_> = token_metadata
        .into_iter()
        .filter_map(|tm| {
            tm.chain.and_then(|c| match c {
                Chain::Ethereum => Some(EvmContractAddress::Ethereum(tm.contract)),
                Chain::Arbitrum => Some(EvmContractAddress::Arbitrum(tm.contract)),
                Chain::Base => Some(EvmContractAddress::Base(tm.contract)),
                _ => None,
            })
        })
        .collect();

    let transaction_url_format = format!("https://dashboard.internetcomputer.org/tokens/{ledger_canister_id}/transactions)");

    add_token_impl(
        ledger_canister_id,
        None,
        None,
        Some(args.info_url),
        Some(transaction_url_format),
        true,
        evm_contract_addresses,
    )
    .await
}
