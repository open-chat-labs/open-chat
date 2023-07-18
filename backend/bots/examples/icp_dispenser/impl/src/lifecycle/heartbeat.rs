use crate::model::pending_actions::PendingAction;
use crate::{mutate_state, read_state, RuntimeState};
use canister_client::make_c2c_call;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::heartbeat;
use ic_ledger_types::{TransferArgs, MAINNET_LEDGER_CANISTER_ID};
use ledger_utils::default_ledger_account;
use tracing::{error, info};
use types::{
    nns, BotMessage, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent,
    TransactionHash, UserId,
};

#[heartbeat]
fn heartbeat() {
    process_pending_actions::run();
}

mod process_pending_actions {
    use super::*;

    pub fn run() {
        if let Some(action) = mutate_state(get_next) {
            info!(?action, "PendingAction processing");
            match action {
                PendingAction::IcpTransfer(user_id, transfer_args, transaction_hash) => {
                    ic_cdk::spawn(process_icp_transfer(user_id, transfer_args, transaction_hash))
                }
                PendingAction::SendMessages(user_id, messages) => ic_cdk::spawn(send_messages(user_id, messages)),
            }
        }
    }

    fn get_next(state: &mut RuntimeState) -> Option<PendingAction> {
        state.data.pending_actions.take()
    }

    async fn process_icp_transfer(recipient: UserId, transfer_args: TransferArgs, transaction_hash: TransactionHash) {
        let action = match icp_ledger_canister_c2c_client::transfer(MAINNET_LEDGER_CANISTER_ID, &transfer_args).await {
            Ok(Ok(block_index)) => {
                let this_canister_id = read_state(|state| state.env.canister_id());
                let message = BotMessage {
                    content: MessageContent::Crypto(CryptoContent {
                        recipient,
                        transfer: CryptoTransaction::Completed(CompletedCryptoTransaction::NNS(
                            nns::CompletedCryptoTransaction {
                                // ledger: Cryptocurrency::InternetComputer.ledger_canister_id(),
                                token: Cryptocurrency::InternetComputer,
                                amount: transfer_args.amount,
                                fee: transfer_args.fee,
                                from: nns::CryptoAccount::Account(default_ledger_account(this_canister_id)),
                                to: nns::CryptoAccount::Account(transfer_args.to),
                                memo: transfer_args.memo,
                                created: transfer_args.created_at_time.map_or(0, |t| t.timestamp_nanos / 1_000_000),
                                transaction_hash,
                                block_index,
                            },
                        )),
                        caption: None,
                    }),
                };
                PendingAction::SendMessages(recipient, vec![message])
            }
            _ => PendingAction::IcpTransfer(recipient, transfer_args, transaction_hash),
        };

        mutate_state(|state| state.data.pending_actions.add(action, state.env.now()));
    }

    async fn send_messages(recipient: UserId, messages: Vec<BotMessage>) {
        let bot_name = read_state(|state| state.data.bot_name.clone());
        let args = user_canister::c2c_handle_bot_messages::Args { bot_name, messages };

        let response: CallResult<user_canister::c2c_handle_bot_messages::Response> =
            make_c2c_call(recipient.into(), "c2c_handle_bot_messages", &args, candid::encode_one, |r| {
                candid::decode_one(r)
            })
            .await;

        if response.is_err() {
            error!(?response, "Error calling 'c2c_handle_bot_messages'");
            // TODO ensure we don't end up retrying forever
            mutate_state(|state| {
                state
                    .data
                    .pending_actions
                    .add(PendingAction::SendMessages(recipient, args.messages), state.env.now());
            })
        }
    }
}
