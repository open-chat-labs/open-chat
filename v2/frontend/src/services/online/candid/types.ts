import type { Principal } from '@dfinity/principal';
export type MarkAsOnlineArgs = {};
export type MarkAsOnlineResponse = { 'Success' : null };
export interface _SERVICE {
  'mark_as_online' : (arg_0: MarkAsOnlineArgs) => Promise<MarkAsOnlineResponse>,
}
