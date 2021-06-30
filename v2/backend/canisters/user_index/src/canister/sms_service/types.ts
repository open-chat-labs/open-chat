import type { Principal } from '@dfinity/agent';
export interface PendingSmsMessagesRequest {
  'max_results' : bigint,
  'from_index' : bigint,
};
export type PendingSmsMessagesResponse = {
    'Success' : {
      'notifications' : Array<SmsNotification>,
      'latest_index' : bigint,
    }
  };
export interface SmsNotification {
  'message' : string,
  'phone_number' : string,
};
export default interface _SERVICE {
  'pending_sms_messages' : (arg_0: PendingSmsMessagesRequest) => Promise<
      PendingSmsMessagesResponse
    >,
};
