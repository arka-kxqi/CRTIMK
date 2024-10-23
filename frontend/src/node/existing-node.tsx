import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { localStorageState } from "../app";
import { atom, selector, useRecoilState, useRecoilValue } from "recoil";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { ClientNode } from "../../../execution-client/types";
import { ClientMessage } from "../../../execution-client/database";
import {
  BountyExecutionState,
  BountyMonitor,
  ExecutionMessageSummaryValue,
} from "../bounty/bounty-monitor";
import { wallet } from "../index";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { readyStateToString } from "./util";
import CableIcon from "@mui/icons-material/Cable";
import { useNavigate } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import { UpdateNodeModal } from "./udpate-node-modal";
import { nanoTimestampToDate } from "../util";
import axios from "axios";

type MetricPoint = {
  ram_used?: number;
  cpu_used?: number;
  disk_used?: number;
  disk_avail?: number;
  disk_total?: number;
  ram_avail?: number;
  ram_total?: number;
  cpu_seconds?: {
    [key: string]: {
      idle: number;
      not_idle: number;
    };
  };
};
type MetricsHistory = MetricPoint[];

export const viewMineOnlyState = atom<boolean>({
  key: "viewMineOnly",
  default: true,
});

export const chainNodesState = selector({
  key: "chainNodes",
  get: async ({ get }) => {
    const viewMineOnly = get(viewMineOnlyState);
    return await fetchNodes(viewMineOnly);
  },
});

const fetchNodes = async (viewMineOnly: boolean) => {
  if (viewMineOnly) {
    return wallet.getNodesOwnedBySelf();
  } else {
    return wallet.getNodes();
  }
};
const nodesState = atom({
  key: "nodesState",
  default: chainNodesState,
});

export default function ExistingNode() {
  const [nodes, setNodes] = useRecoilState(nodesState);

  const [viewMineOnly, setViewMineOnly] = useRecoilState(viewMineOnlyState);
  //Refresh nodes every 2s. Node data doesn't change w/o a transaction, so this is moreso ceremony
  useEffect(() => {
    const getNodes = async () => {
      const fetchedNodes = await fetchNodes(viewMineOnly);
      setNodes(fetchedNodes);
    };
    const pollingInterval = setInterval(getNodes, 2000);
    return () => {
      clearInterval(pollingInterval);
    };
  }, []);
  return (
    <React.Suspense fallback={<Typography>loading..</Typography>}>
      <div style={{ marginTop: "24px" }}>
        {Object.values(nodes).length === 0 && (
          <Typography variant="h6" component="h2">
            No Existing Nodes
          </Typography>
        )}
        {Object.values(nodes).length > 0 && (
          <TableContainer component={Paper}>
            <Table aria-label="collapsible table">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Name</TableCell>
                  <TableCell align="center">Last Success</TableCell>
                  <TableCell align="center">Last Failure</TableCell>
                  <TableCell align="center">Active Bounties</TableCell>
                  <TableCell align="center">RAM Usage</TableCell>
                  <TableCell align="center">CPU Usage</TableCell>
                  <TableCell align="center">Disk Usage</TableCell>
                  <TableCell align="center">URL</TableCell>
                  <TableCell align="center">Connection</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.values(nodes).map((node) => (
                  <Row key={node.id} node={node} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </React.Suspense>
  );
}

const MetricChip: React.FC<{ metrics: MetricPoint[]; metricKey: string }> = ({
  metrics,
  metricKey,
}) => {
  if (metrics.length === 0)
    return <Chip label="N/A" sx={{ color: "rgb(0,30,60)" }} />;
  const rawMetric =
    metrics.reduce((acc, cur) => acc + (cur[metricKey] || 0), 0) /
    metrics.length;
  // const metric = Math.round(rawMetric * 100)
  // const metric = Math.round(rawMetric * 100)
  const metric = rawMetric * 100;
  return (
    <Chip
      label={`${metric.toFixed(1)}%`}
      sx={{
        color: "rgb(0, 30, 60);",
        backgroundColor: () => {
          return `rgb(${Math.min(
            208,
            170 + (metric < 50 ? 0 : metric) * 1.6
          )},${Math.max(85, 208 - (metric < 50 ? 0 : metric) * 1.6)},85)`;
        },
      }}
    />
  );
};

// setNodes is used to update local storage when the user changes the URL
function Row({ node }: { node: ClientNode }) {
  const storage = useRecoilValue(localStorageState);
  const [url, setUrl] = useState<string>(storage.get(node.id)?.url ?? "");
  const { lastMessage, readyState } = useWebSocket(url);

  const [bountyState, setBountyState] = useState<BountyExecutionState>({});
  const [open, setOpen] = React.useState(false);
  const [openModal, setOpenModal] = React.useState(false);
  const [tempUrl, setTempUrl] = React.useState<string>(
    storage.get(node.id)?.url ?? ""
  );
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  );
  const [metrics, setMetrics] = React.useState<MetricsHistory>([]);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  const navigate = useNavigate();

  const metricsUrl = url
    .replace(/wss?/, "http")
    // .replace(/(.*):([0-9]+).*/, "$1:9100/metrics");
    .replace(/(.*):([0-9]+).*/, "$1/metrics");
  const incompleteBounties = Object.values(bountyState).filter(
    (bounty) => bounty.phase !== "Complete"
  ).length;
  //Update bounty state when the websocket message comes in
  useEffect(() => {
    if (lastMessage) {
      //Validate that message is of a type we care about
      const { bountyId, data, sentAt } = JSON.parse(
        lastMessage.data
      ) as ClientMessage;
      const current = bountyState[node.id + bountyId];
      const bounty: ExecutionMessageSummaryValue = {
        nodeId: node.id,
        bountyId,
        phase: data.phase || current?.phase || "new",
        lastUpdate: sentAt,
      };
      setBountyState({ ...bountyState, [node.id + bountyId]: bounty });
    }
  }, [url, lastMessage, readyState]);

  // Metrics useEffect
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!metricsUrl) return;
      const response = await axios({
        method: "get",
        url: metricsUrl,
        withCredentials: false,
      });
      let memAvailable = 0,
        memTotal = 0,
        filesystemAvail = 0,
        filesystemSize = 0,
        cpuUsage = 0;
      const a: MetricPoint = {
        cpu_seconds: {},
      };
      for (const line of response?.data.split("\n")) {
        if (line.startsWith("#")) continue;
        const [metric, value] = line.split(" ");

        //100 - (avg(rate(node_cpu_seconds_total{instance="INSTANCE",job="JOB",replica="REPLICA"}[1m])) - avg(rate(node_cpu_seconds_total{instance="INSTANCE",mode="idle",job="JOB",replica="REPLICA"}[1m])) * 100)

        if (
          metric.startsWith("node_filesystem_avail_bytes") &&
          metric.includes('mountpoint="/"')
        ) {
          a.disk_avail = Number(value);
        } else if (
          metric.startsWith("node_filesystem_size_bytes") &&
          metric.includes('mountpoint="/"')
        ) {
          a.disk_total = Number(value);
        } else if (metric.startsWith("node_memory_MemAvailable_bytes")) {
          a.ram_avail = Number(value);
        } else if (metric.startsWith("node_memory_MemTotal_bytes")) {
          a.ram_total = Number(value);
        } else if (metric.startsWith("node_cpu_seconds_total")) {
          const mode = metric.match(/mode="([^"]+)"/)[1];
          const cpu = metric.match(/cpu="([^"]+)"/)[1];
          const metricKey = mode === "idle" ? "idle" : "not_idle";
          if (!a.cpu_seconds[cpu])
            a.cpu_seconds[cpu] = { idle: 0, not_idle: 0 };
          a.cpu_seconds[cpu] = {
            ...a.cpu_seconds[cpu],
            [metricKey]: a.cpu_seconds[cpu][metricKey] + Number(value),
          };
        }
      }
      a.disk_used = 1 - a.disk_avail / a.disk_total;
      a.ram_used = 1 - a.ram_avail / a.ram_total;
      // console.log(a.cpu_seconds)
      const totalUsage = Object.values(a.cpu_seconds).reduce((acc, cpu) => {
        // console.log(`${acc} + (${cpu.not_idle} / (${cpu.idle} + ${cpu.not_idle})`)
        return acc + cpu.not_idle / (cpu.idle + cpu.not_idle);
        return acc + cpu.not_idle / (cpu.idle + cpu.not_idle);
      }, 0);
      // console.log(`avgUsageAcrossCPUS: ${totalUsage/Object.keys(a.cpu_seconds).length}`)
      a.cpu_used = totalUsage / Object.keys(a.cpu_seconds).length;
      const newMetrics = [...metrics, a];
      if (newMetrics.length > 3) {
        newMetrics.shift();
      }
      setMetrics(newMetrics);
    };
    const pollingInterval = setInterval(fetchMetrics, 1000);
    return () => {
      clearInterval(pollingInterval);
    };
  }, [url, metrics]);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTempUrl(event.target.value);
  };

  const handleSetUrl = (nodeId: string) => {
    storage.set(nodeId, { url: tempUrl });
    setUrl(tempUrl);
  };

  const handleCloseModal = () => setOpenModal(false);

  // TODO: Replace with actual metrics once integrated
  const cpuUsage = 10;
  const diskUsage = 50;
  const ramUsage = 100;
  return (
    <React.Fragment>
      <TableRow
        key={node.id}
        sx={{
          "& > *": { borderBottom: "unset" },
          backgroundImage:
            incompleteBounties > 0
              // ? "linear-gradient(to right, #6B6EF9 , #DB5555);"
              ? "linear-gradient(to right, #6B6EF9 , #A463B0);"
              : "",
        }}
      >
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant={"body1"}>{node.id.replace(`.node.${node.owner_id}`, "")}</Typography>
        </TableCell>
        <TableCell align="center">
          <Typography variant={"body1"}>

          {node.last_success
            ? nanoTimestampToDate(node.last_success).toLocaleString()
            : "N/A"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Typography variant={"body1"}>
          {node.last_failure
            ? nanoTimestampToDate(node.last_failure).toLocaleString()
            : "N/A"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={incompleteBounties}
            color={incompleteBounties > 0 ? "secondary" : "primary"}
          />
        </TableCell>
        <TableCell align="center">
          <MetricChip metrics={metrics} metricKey={"ram_used"} />
        </TableCell>
        <TableCell align="center">
          <MetricChip metrics={metrics} metricKey={"cpu_used"} />
        </TableCell>
        <TableCell align="center">
          <MetricChip metrics={metrics} metricKey={"disk_used"} />
        </TableCell>
        <TableCell align="center">
          <FormControl>
            <OutlinedInput
              id="node-ws-endpoint"
              onChange={handleUrlChange}
              placeholder={"ws://localhost:8081"}
              value={tempUrl}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Set URL"
                    onClick={() => handleSetUrl(node.id)}
                    edge="end"
                  >
                    {<CableIcon />}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
        </TableCell>
        <TableCell align="center">
          {url && (
            <Chip
              color={readyState === ReadyState.OPEN ? "success" : "error"}
              label={readyStateToString(readyState)}
            />
          )}
        </TableCell>
        <TableCell align="center">
          <Button
            color="secondary"
            variant={"contained"}
            onClick={handleOpenUserMenu}
          >
            Actions
          </Button>
          <Menu
            sx={{ mt: "45px" }}
            id="node-action-button"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            <MenuItem
              key="Edit"
              onClick={() => {
                setOpenModal(!openModal);
                handleCloseUserMenu();
              }}
            >
              <Typography textAlign="center">Edit</Typography>
            </MenuItem>
            <MenuItem
              key="Details"
              onClick={() => {
                navigate(`/node/${node.id}`);
                handleCloseUserMenu();
              }}
            >
              <Typography textAlign="center">Details</Typography>
            </MenuItem>
          </Menu>
          <UpdateNodeModal
            node={node}
            open={openModal}
            handleClose={handleCloseModal}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={11}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <BountyMonitor bountyState={bountyState} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}
