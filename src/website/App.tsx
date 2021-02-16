import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "./reducers";

import { setupBackgroundTasks } from "./backgroundTasks";

import Main from "./components/Main";
import Side from "./components/Side";
import { SidePanelType } from "./actions/changeSidePanel";
import NewDirectChatSidePanel from "./components/NewDirectChatSidePanel";
import NewGroupChatSidePanel from "./components/NewGroupChatSidePanel";

export default App;

function App() {

    const leftPanelState = useSelector((state: RootState) => state.sidePanelState.leftPanel);

    let sidePanel;

    switch (leftPanelState) {
        case SidePanelType.NewDirectChat: sidePanel = <NewDirectChatSidePanel />; break;
        case SidePanelType.NewGroupChat: sidePanel = <NewGroupChatSidePanel />; break;
        default: sidePanel = <Side />; break;
    }

    setupBackgroundTasks();

    return (
        <>
            {sidePanel}
            <Main />
        </>
    );
}
