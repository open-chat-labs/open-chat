import React from "react";
import { useSelector } from "react-redux";
import { Container, Grid, makeStyles, Theme, useMediaQuery, useTheme } from "@material-ui/core";

import { RootState } from "./reducers";
import { setupBackgroundTasks } from "./backgroundTasks";
import { Option } from "./domain/model/common";
import { SidePanelState } from "./reducers/sidePanelReducer";
import { RightPanelType } from "./actions/changeSidePanel";
import LeftPanel from "./components/leftPanel/LeftPanel";
import MainPanel from "./components/mainPanel/MainPanel";
import RightPanel from "./components/rightPanel/RightPanel";

export default App;

const useStyles = makeStyles((theme: Theme) => ({
    left: {
        height: "100%",
        backgroundColor: "white",
        borderRight: "1px solid #dddddd"
    },
    main: {
        height: "100%",
        backgroundColor: "#3dc5ee"
    },
    right: {
        height: "100%",
        backgroundColor: "white",
        borderLeft: "1px solid #dddddd"
    }
}));

function App() {
    const classes = useStyles();
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);
    const theme = useTheme();
    const removePadding = useMediaQuery(theme.breakpoints.down('md'));

    setupBackgroundTasks();

    function buildLeftPanel(sidePanelState: SidePanelState): JSX.Element {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;

        return (
            <Grid
                item
                container
                direction="column"
                wrap="nowrap"
                className={"sidebar left-panel " + classes.left}
                xs={rightPanelActive ? 3 : 5}
                lg={rightPanelActive ? 3 : 4}
            >
                <LeftPanel type={sidePanelState.leftPanel} rightPanelActive={rightPanelActive} />
            </Grid>
        );
    }

    function buildMainPanel(sidePanelState: SidePanelState): JSX.Element  {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;

        return (
            <Grid
                item
                container
                direction="column"
                className={"main-panel " + classes.main}
                xs={rightPanelActive ? 4 : 7}
                lg={rightPanelActive ? 5 : 8}
            >
                <MainPanel />
            </Grid>
        );
    }
    
    function buildRightPanel(sidePanelState: SidePanelState): Option<JSX.Element>  {
        if (sidePanelState.rightPanel === RightPanelType.None) {
            return null;
        }

        return (
            <Grid item className={"sidebar right-panel " + classes.right} xs={4}>
                <RightPanel type={sidePanelState.rightPanel} />
            </Grid>
        );
    }

    return (
        <Container maxWidth="lg" style={{ padding: removePadding ? 0 : 24, height: "100vh" }}>
            <Grid container style={{ height: "100%", overflow: "hidden" }}>
                {buildLeftPanel(sidePanelState)}
                {buildMainPanel(sidePanelState)}
                {buildRightPanel(sidePanelState)}
            </Grid>
        </Container>
    );
}
