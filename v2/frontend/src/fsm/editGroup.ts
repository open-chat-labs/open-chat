export type EditGroupState = "group_details" | "add_participants" | "show_participants";

export type UpdatedAvatar = {
    blobUrl?: string;
    blobData?: Uint8Array;
};

export type UpdatedGroup = {
    name: string;
    desc: string;
    avatar?: UpdatedAvatar;
    joinAsViewer: boolean;
};
