export const idlFactory = ({ IDL }) => {
    const PKKey = IDL.Nat32;
    const GetCoinFullReq = IDL.Record({
        id: PKKey,
        select: IDL.Opt(IDL.Vec(IDL.Text)),
    });
    const Doc = IDL.Record({
        id: PKKey,
        decimals: IDL.Nat8,
        deleted: IDL.Bool,
        name: IDL.Text,
        rank: IDL.Nat32,
        tags: IDL.Vec(IDL.Text),
        ledger_id: IDL.Text,
        details_json: IDL.Text,
        overview_json: IDL.Text,
        symbol: IDL.Text,
        unlisted: IDL.Bool,
    });
    const Value = IDL.Float64;
    const GetCoinFullResp = IDL.Tuple(Doc, IDL.Vec(IDL.Tuple(IDL.Text, Value)));
    const GetCoinsByMarketcapReq = IDL.Record({
        from: IDL.Opt(IDL.Nat64),
        full: IDL.Bool,
        select: IDL.Opt(IDL.Vec(IDL.Text)),
    });
    const CoinWithDetails = IDL.Record({
        id: PKKey,
        decimals: IDL.Nat8,
        deleted: IDL.Bool,
        name: IDL.Text,
        rank: IDL.Nat32,
        tags: IDL.Vec(IDL.Text),
        ledger_id: IDL.Text,
        details_json: IDL.Text,
        details: IDL.Vec(IDL.Tuple(IDL.Text, Value)),
        overview_json: IDL.Text,
        symbol: IDL.Text,
        unlisted: IDL.Bool,
    });
    const GetCoinsByMarketcapResp = IDL.Record({
        last: IDL.Opt(IDL.Nat64),
        coins: IDL.Vec(CoinWithDetails),
    });
    const GetDetailsReq = IDL.Record({
        id: PKKey,
        select: IDL.Opt(IDL.Vec(IDL.Text)),
    });
    const GetDetailsResp = IDL.Vec(IDL.Tuple(IDL.Text, Value));
    const SetReq = IDL.Record({
        id: PKKey,
        decimals: IDL.Nat8,
        deleted: IDL.Bool,
        name: IDL.Text,
        rank: IDL.Nat32,
        tags: IDL.Vec(IDL.Text),
        ledger_id: IDL.Text,
        details_json: IDL.Text,
        overview_json: IDL.Text,
        symbol: IDL.Text,
        unlisted: IDL.Bool,
    });
    const SetDetailsReq = IDL.Vec(
        IDL.Record({
            id: PKKey,
            details: IDL.Vec(IDL.Tuple(IDL.Text, Value)),
        }),
    );
    return IDL.Service({
        get_coin_full: IDL.Func([GetCoinFullReq], [GetCoinFullResp], []),
        get_coins_by_marketcap: IDL.Func([GetCoinsByMarketcapReq], [GetCoinsByMarketcapResp], []),
        get_details: IDL.Func([GetDetailsReq], [GetDetailsResp], []),
        set: IDL.Func([SetReq], [], ["oneway"]),
        set_details: IDL.Func([SetDetailsReq], [], ["oneway"]),
    });
};
export const init = ({ IDL }) => {
    return [];
};
