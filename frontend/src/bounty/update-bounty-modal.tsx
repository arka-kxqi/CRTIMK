import React, { useContext } from "react";
import {
  Box,
  Button,
  FormControl,
  FormGroup,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import { WalletContext } from "../app";

const modalStyle = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

export const UpdateBountyModal = ({
  bountyId,
  field,
  open,
  handleClose,
}: {
  bountyId: string;
  field: string;
  open: boolean;
  handleClose: () => void;
}) => {
  const wallet = useContext(WalletContext);
  const [value, setValue] = React.useState("");
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };
  const handleSubmit = async () => {
    try {
      if (field === "Reward") {
        await wallet.addReward(bountyId, value);
      } else if (field === "Storage") {
        await wallet.addStorage(bountyId, value);
      }
      handleClose();
    } catch (e: any) {
      console.log(`Error updating bounty: ${e}`);
    }
  };
  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="create-bounty-modal-title"
      aria-describedby="create-bounty-modal-description"
    >
      <Box sx={modalStyle}>
        <Typography id="create-bounty-modal-title" variant="h5" component="h2">
          Add {field}
        </Typography>
        <FormGroup>
          <FormControl margin="normal">
            <TextField
              required
              fullWidth
              id="update-bounty-value"
              label={field}
              variant="outlined"
              size="small"
              onChange={handleChange}
            />
          </FormControl>
          <FormControl margin="normal">
            <Button variant="contained" onClick={handleSubmit}>
              Update
            </Button>
          </FormControl>
        </FormGroup>
      </Box>
    </Modal>
  );
};
