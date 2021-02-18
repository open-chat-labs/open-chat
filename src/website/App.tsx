import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "./reducers";
import { setupBackgroundTasks } from "./backgroundTasks";
import { Option } from "./domain/model/common";
import Main from "./components/Main";
import Side from "./components/Side";
import { LeftPanelType, RightPanelType } from "./actions/changeSidePanel";
import NewDirectChatSidePanel from "./components/NewDirectChatSidePanel";
import NewGroupChatSidePanel from "./components/NewGroupChatSidePanel";
import AddParticipantsSidePanel from "./components/AddParticipantsSidePanel";
import { SidePanelState } from "./reducers/sidePanelReducer";
import ParticipantsSidePanel from "./components/ParticipantsSidePanel";

export default App;

function App() {
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);

    setupBackgroundTasks();

    function buildLeftPanel(sidePanelState: SidePanelState): JSX.Element {
        let panel;
        switch (sidePanelState.leftPanel) {
            case LeftPanelType.NewDirectChat: 
                panel = <NewDirectChatSidePanel />; 
                break;
            case LeftPanelType.NewGroupChat: 
                panel = <NewGroupChatSidePanel />; 
                break;
            case LeftPanelType.Chats: 
                panel = <Side />; 
                break;
        }

        let className = "sidebar left-panel";
        if (sidePanelState.rightPanel != RightPanelType.None) {
            className += " with-right";
        }
        return <section className={className}>{panel}</section>;
    }

    function buildMainPanel(sidePanelState: SidePanelState): JSX.Element  {
        let className = "main-panel";
        if (sidePanelState.rightPanel != RightPanelType.None) {
            className += " with-right";
        }
        return <main className={className}><Main /></main>;
    }
    
    function buildRightPanel(sidePanelState: SidePanelState): Option<JSX.Element>  {
        if (sidePanelState.rightPanel == RightPanelType.None) {
            return null;
        }

        let panel;
        switch (sidePanelState.rightPanel) {
            case RightPanelType.AddParticpants: 
                panel = <AddParticipantsSidePanel />
                break;
            case RightPanelType.Particpants: 
                panel = <ParticipantsSidePanel />
                break;
        }    

        return <section className="sidebar right-panel">{panel}</section>;
    }

    return (
        <>
            {buildLeftPanel(sidePanelState)}
            {buildMainPanel(sidePanelState)}
            {buildRightPanel(sidePanelState)}
        </>
    );
}
