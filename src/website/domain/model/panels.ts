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
    Participants,
}

export type PanelState = {
    leftPanel: LeftPanelType,
    middlePanel: MiddlePanelType,
    rightPanel: RightPanelType
}
