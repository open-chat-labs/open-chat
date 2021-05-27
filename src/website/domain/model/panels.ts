export enum LeftPanelType {
    None,
    Chats,
    JoinGroupChat,
    NewDirectChat,
    NewGroupChat,
}

export enum MiddlePanelType {
    None,
    Messages
}

export enum RightPanelType {
    None,
    AddParticipants,
    Particpants,
}

export type PanelState = {
    leftPanel: LeftPanelType,
    middlePanel: MiddlePanelType,
    rightPanel: RightPanelType
}
