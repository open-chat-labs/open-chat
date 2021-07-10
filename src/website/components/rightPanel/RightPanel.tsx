import React from "react";
import AddParticipantsSidePanel from "./AddParticipantsPanel";
import ParticipantsSidePanel from "./ParticipantsPanel";
import { RightPanelType } from "../../domain/model/panels";

export default RightPanel;

type Props = {
  type: Exclude<RightPanelType, RightPanelType.None>;
};

function RightPanel(props: Props): JSX.Element {
  switch (props.type) {
    case RightPanelType.AddParticipants:
      return <AddParticipantsSidePanel />;
    case RightPanelType.Participants:
      return <ParticipantsSidePanel />;
    default:
      return <></>;
  }
}
