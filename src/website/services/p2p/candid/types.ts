import type { Principal } from '@dfinity/principal';
export interface AddAnswerRequest {
  'id' : string,
  'connection_string' : string,
  'user_id' : UserId,
  'ice_candidates' : Array<string>,
  'offer_id' : string,
}
export interface AddAnswersRequest { 'answers' : Array<AddAnswerRequest> }
export interface AddOfferRequest {
  'id' : string,
  'connection_string' : string,
  'user_id' : UserId,
  'ice_candidates' : Array<string>,
}
export interface AddOffersRequest { 'offers' : Array<AddOfferRequest> }
export type AddOffersResponse = { 'Success' : AddOffersResult };
export interface AddOffersResult { 'counter_offers' : Array<Offer> }
export interface Answer {
  'id' : string,
  'connection_string' : string,
  'user_id' : UserId,
  'ice_candidates' : Array<string>,
  'offer_id' : string,
  'age_seconds' : number,
}
export type ConnectionDetails = { 'Answer' : Answer } |
  { 'Offer' : Offer };
export type GetConnectionDetailsResponse = {
    'Success' : GetConnectionDetailsResult
  };
export interface GetConnectionDetailsResult {
  'connections' : Array<ConnectionDetails>,
  'timestamp' : Timestamp,
}
export interface Offer {
  'id' : string,
  'connection_string' : string,
  'user_id' : UserId,
  'ice_candidates' : Array<string>,
  'age_seconds' : number,
}
export interface RemoveConnectionDetailsRequest {
  'connections' : Array<RemoveSingleConnectionRequest>,
}
export interface RemoveSingleConnectionRequest {
  'id' : string,
  'user_id' : UserId,
}
export type Timestamp = bigint;
export type UserId = Principal;
export interface _SERVICE {
  'add_answers' : (arg_0: AddAnswersRequest) => Promise<undefined>,
  'add_offers' : (arg_0: AddOffersRequest) => Promise<AddOffersResponse>,
  'get_connection_details' : (arg_0: [] | [Timestamp]) => Promise<
      GetConnectionDetailsResponse
    >,
  'remove_connection_details' : (
      arg_0: RemoveConnectionDetailsRequest,
    ) => Promise<number>,
}