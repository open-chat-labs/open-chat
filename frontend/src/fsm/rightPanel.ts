export type RightPanelState =
    | "group_details"
    | "add_participants"
    | "show_participants"
    | "show_pinned";

export type UpdatedAvatar = {
    blobUrl?: string;
    blobData?: Uint8Array;
};

export type UpdatedGroup = {
    name: string;
    desc: string;
    avatar?: UpdatedAvatar;
};
