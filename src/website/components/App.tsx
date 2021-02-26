import React from "react";
import { useSelector } from "react-redux";
import { Container, Divider, Grid, makeStyles, Theme, useMediaQuery, useTheme } from "@material-ui/core";

import { RootState } from "../reducers";
import { Option } from "../domain/model/common";
import { SidePanelState } from "../reducers/sidePanelReducer";
import { RightPanelType } from "../actions/changeSidePanel";
import LeftPanel from "./leftPanel/LeftPanel";
import MainPanel from "./mainPanel/MainPanel";
import RightPanel from "./rightPanel/RightPanel";
import { setupBackgroundTasks } from "../backgroundTasks";

export default App;

const useStyles = makeStyles((theme: Theme) => ({
    "@global": {
        body: {
            height: "100vh",
            width: "100vw",
            backgroundColor: theme.customColors.outerBackgroundColor
        },
        header: {
            backgroundColor: theme.customColors.headerBackgroundColor,
            height: 52,
            flexShrink: 0,
            padding: "0 15px"
        }
    },
    container: {
        padding: 24,
        height: "100%",
        "&.no-padding": {
            padding: 0
        }
    },
    grid: {
        height: "100%",
        overflow: "hidden",
        backgroundColor: theme.customColors.sidePanelBackgroundColor
    },
    left: {
        height: "100%",
        width: "40%",
        "&.rightPanelActive": {
            width: "30%"
        }
    },
    main: {
        height: "100%",
        backgroundColor: theme.customColors.mainPanelBackgroundColor,
        width: "60%",
        "&.rightPanelActive": {
            width: "40%"
        }
    },
    right: {
        height: "100%",
        width: "30%"
    }
}));

function App() {
    const classes = useStyles();
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);
    const theme = useTheme();
    const removePadding = useMediaQuery(theme.breakpoints.down("md"));

    setupBackgroundTasks();

    function buildLeftPanel(sidePanelState: SidePanelState): JSX.Element {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = classes.left;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <>
                <Grid
                    item
                    container
                    direction="column"
                    wrap="nowrap"
                    className={className}>
                    <LeftPanel type={sidePanelState.leftPanel} />
                </Grid>
                <Divider orientation="vertical" flexItem />
            </>
        );
    }

    function buildMainPanel(sidePanelState: SidePanelState): JSX.Element  {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = "main-panel " + classes.main;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <Grid
                item
                container
                direction="column"
                className={className}>
                <MainPanel />
            </Grid>
        );
    }

    function buildRightPanel(sidePanelState: SidePanelState): Option<JSX.Element>  {
        if (sidePanelState.rightPanel === RightPanelType.None) {
            return null;
        }

        return (
            <>
                <Divider orientation="vertical" flexItem />
                <Grid item className={classes.right}>
                    <RightPanel type={sidePanelState.rightPanel} />
                </Grid>
            </>
        );
    }

    let containerClass = classes.container;
    if (removePadding) {
        containerClass += " no-padding";
    }

    return (
        <Container maxWidth="lg" className={containerClass}>
            <Grid container wrap="nowrap" className={classes.grid}>
                {buildLeftPanel(sidePanelState)}
                {buildMainPanel(sidePanelState)}
                {buildRightPanel(sidePanelState)}
            </Grid>
        </Container>
    );
}
