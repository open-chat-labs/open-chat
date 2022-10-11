export const idlFactory = ({ IDL }) => {
    const SearchArgs = IDL.Record({
        'max_results': IDL.Nat8,
        'search_term': IDL.Text,
    });
    const CanisterId = IDL.Principal;
    const ChatId = CanisterId;
    const GroupMatch = IDL.Record({
        'name': IDL.Text,
        'description': IDL.Text,
        'avatar_id': IDL.Opt(IDL.Nat),
        'chat_id': ChatId,
    });
    const SearchSuccessResult = IDL.Record({ 'matches': IDL.Vec(GroupMatch) });
    const SearchResponse = IDL.Variant({
        'TermTooShort': IDL.Nat8,
        'Success': SearchSuccessResult,
        'TermTooLong': IDL.Nat8,
        'InvalidTerm': IDL.Null,
    });
    return IDL.Service({
        'search': IDL.Func([SearchArgs], [SearchResponse], ['query']),
    });
};
export const init = ({ IDL }) => { return []; };
//# sourceMappingURL=idl.js.map