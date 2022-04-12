use async_trait::async_trait;
use aws_sdk_pinpoint::model::{
    AddressConfiguration, ChannelType, DirectMessageConfiguration, MessageRequest, SmsMessage, Template, TemplateConfiguration,
};
use aws_sdk_pinpoint::Client;
use aws_types::sdk_config::SdkConfig;
use sms_sender_core::SmsSender;
use types::Error;

pub struct PinpointClient {
    client: Client,
    application_id: String,
    address_configuration: AddressConfiguration,
    template_configuration: TemplateConfiguration,
}

impl PinpointClient {
    pub fn build(config: &SdkConfig, application_id: String) -> PinpointClient {
        let client = Client::new(config);
        let address_configuration = AddressConfiguration::builder().channel_type(ChannelType::Sms).build();
        let template_configuration = TemplateConfiguration::builder()
            .sms_template(Template::builder().name("confirmation_code").build())
            .build();

        PinpointClient {
            client,
            application_id,
            address_configuration,
            template_configuration,
        }
    }
}

#[async_trait]
impl SmsSender for PinpointClient {
    async fn send(&self, phone_number: String, code: String) -> Result<(), Error> {
        self.client
            .send_messages()
            .application_id(self.application_id.clone())
            .message_request(
                MessageRequest::builder()
                    .addresses(phone_number, self.address_configuration.clone())
                    .template_configuration(self.template_configuration.clone())
                    .message_configuration(
                        DirectMessageConfiguration::builder()
                            .sms_message(SmsMessage::builder().substitutions("confirmation_code", vec![code]).build())
                            .build(),
                    )
                    .build(),
            )
            .send()
            .await?;

        Ok(())
    }
}
