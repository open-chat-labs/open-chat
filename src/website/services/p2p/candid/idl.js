export const idlFactory = ({ IDL }) => {
  const UserId = IDL.Principal;
  const AddAnswerRequest = IDL.Record({
    'id' : IDL.Text,
    'connection_string' : IDL.Text,
    'user_id' : UserId,
    'ice_candidates' : IDL.Vec(IDL.Text),
    'offer_id' : IDL.Text,
  });
  const AddAnswersRequest = IDL.Record({
    'answers' : IDL.Vec(AddAnswerRequest),
  });
  const AddOfferRequest = IDL.Record({
    'id' : IDL.Text,
    'connection_string' : IDL.Text,
    'user_id' : UserId,
    'ice_candidates' : IDL.Vec(IDL.Text),
  });
  const AddOffersRequest = IDL.Record({ 'offers' : IDL.Vec(AddOfferRequest) });
  const Offer = IDL.Record({
    'id' : IDL.Text,
    'connection_string' : IDL.Text,
    'user_id' : UserId,
    'ice_candidates' : IDL.Vec(IDL.Text),
    'age_seconds' : IDL.Nat32,
  });
  const AddOffersResult = IDL.Record({ 'counter_offers' : IDL.Vec(Offer) });
  const AddOffersResponse = IDL.Variant({ 'Success' : AddOffersResult });
  const Timestamp = IDL.Nat64;
  const Answer = IDL.Record({
    'id' : IDL.Text,
    'connection_string' : IDL.Text,
    'user_id' : UserId,
    'ice_candidates' : IDL.Vec(IDL.Text),
    'offer_id' : IDL.Text,
    'age_seconds' : IDL.Nat32,
  });
  const ConnectionDetails = IDL.Variant({ 'Answer' : Answer, 'Offer' : Offer });
  const GetConnectionDetailsResult = IDL.Record({
    'connections' : IDL.Vec(ConnectionDetails),
    'timestamp' : Timestamp,
  });
  const GetConnectionDetailsResponse = IDL.Variant({
    'Success' : GetConnectionDetailsResult,
  });
  const RemoveSingleConnectionRequest = IDL.Record({
    'id' : IDL.Text,
    'user_id' : UserId,
  });
  const RemoveConnectionDetailsRequest = IDL.Record({
    'connections' : IDL.Vec(RemoveSingleConnectionRequest),
  });
  return IDL.Service({
    'add_answers' : IDL.Func([AddAnswersRequest], [], []),
    'add_offers' : IDL.Func([AddOffersRequest], [AddOffersResponse], []),
    'get_connection_details' : IDL.Func(
        [IDL.Opt(Timestamp)],
        [GetConnectionDetailsResponse],
        ['query'],
      ),
    'remove_connection_details' : IDL.Func(
        [RemoveConnectionDetailsRequest],
        [IDL.Nat32],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };