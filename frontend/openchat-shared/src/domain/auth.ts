export enum AuthProvider {
    II = "Internet Identity",
    NFID = "NFID",
}

export type NotAuthorised = {
    kind: "not_authorized";
};
