import React from "react";
import { RightPanelType } from "../../actions/changeSidePanel";
import AddParticipantsSidePanel from "./AddParticipantsPanel";
import ParticipantsSidePanel from "./ParticipantsPanel";

export default RightPanel;

type Props = {
    type: Exclude<RightPanelType, RightPanelType.None>
}

function RightPanel(props: Props) {
    switch (props.type) {
        case RightPanelType.AddParticipants:
            return <AddParticipantsSidePanel />;
        case RightPanelType.Particpants:
            return <ParticipantsSidePanel/>;
    }
}
