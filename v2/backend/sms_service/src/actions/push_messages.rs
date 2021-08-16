use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use crate::read_env_var;
use crate::sns::SnsClient;
use lambda_runtime::Error;
use types::CanisterId;

pub async fn run(canister_id: CanisterId) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();
    let sns_client = SnsClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;

    let from_sms_index = dynamodb_client
        .get_sms_index_processed_up_to(canister_id)
        .await?
        .map_or(0, |i| i + 1);

    let ic_response = ic_agent.get_sms_messages(canister_id, from_sms_index).await?;

    if let Some(latest_sms_index) = ic_response.messages.last().map(|e| e.index) {
        let messages = ic_response.messages.into_iter().map(|e| e.value).collect();
        sns_client.push_messages(messages).await?;

        dynamodb_client
            .set_sms_index_processed_up_to(canister_id, latest_sms_index)
            .await?;
    }

    Ok(())
}
