import React, { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Peer from "simple-peer";
import io from "socket.io-client";
import { Button, IconButton, TextField, Grid, Paper } from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";

const socket = io.connect('https://rig-zig.herokuapp.com/');
// const socket = io.connect("http://localhost:8080");

const Videos = (props) => {
  const {stream} = props;
  const [receivingCall, setReceivingCall] = useState(false);
  const [me, setMe] = useState("");
  const [idToCall, setIdToCall] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callEnded, setCallEnded] = useState(false);
  const [callAccepted, setCallerAccepted] = useState(false);
  const [caller, setCaller] = useState("");
  const [name, setName] = useState("");
  const [videoStream, setVideoStream] = useState()

  const myVideo = useRef();
  const connectionRef = useRef();
  const otherUserVideo = useRef();

  

  useEffect(() => {
    
    console.log('stream TEST', stream)
    
    if (!!stream) myVideo.current.srcObject = stream;
    // (!! stream ? myVideo.current.srcObject = stream : null)  
      
    socket.on("me", (id) => {
      setMe(id);
    });

    socket.on("callUser", ({ from, name, signal }) => {
      setReceivingCall(true);
      setCaller(from);
      setName(name);
      setCallerSignal(signal);
    });
  }, [(!!stream)])

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });

    peer.on("stream", (stream) => {
      otherUserVideo.current.srcObject = stream;
    });

    socket.on("callAccepted", (signal) => {
      setCallerAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallerAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });
    peer.on("stream", (stream) => {
      otherUserVideo.current.srcObject = stream;
    });

    peer.signal(callerSignal);

    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    connectionRef.current.destroy();
  };
  
  return (
    <>
      
      <Grid container spacing={1} justifyContent="center" alignItems="center">
        <Grid item lg={6} md={6} sm={12} xs={12}>
          <Paper component="div" sx={{p:"2"}} elevation={2}>
          <div className="video">
            {stream && (
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                style={{ width: "95%", height: "95%", borderRadius: "5px" }}
              />
            )}
          </div>
          </Paper>
        </Grid>
        <Grid item lg={6} md={6} sm={12} xs={12}>
          <div className="video">
            {callAccepted && !callEnded ? (
              <video
                playsInline
                ref={otherUserVideo}
                autoPlay
                style={{ width: "95%", height: "95%", borderRadius: "5px" }}
                className="overlay"
              />
            ) : null}
          </div>
        </Grid>

        <Grid item lg={12} md={12} sm={12} xs={12}>
          <div className="callerId">
            <TextField
              id="myName"
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              sx={{ mb: "20px" }}
            />
            <p className="callControlls">
              <span className="myId">My ID:</span>
              <br /> {me}
            </p>
            <CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
              <Button className="copyId" startIcon={<AssignmentIcon fontSize="large" />}>
                Copy My ID
              </Button>
            </CopyToClipboard>
            <TextField
              id="idToCall"
              label="ID to Call"
              value={idToCall}
              onChange={(event) => setIdToCall(event.target.value)}
            />
            <div className="callButton">
              {callAccepted && !callEnded ? (
                <Button onClick={leaveCall}>End Call</Button>
              ) : (
                <IconButton
                  aria-label="call"
                  onClick={() => callUser(idToCall)}
                >
                  <PhoneIcon fontSize="large" />
                </IconButton>
              )}
              
            </div>
          </div>
        </Grid>
        <Grid item lg={12} md={12} sm={12} xs={12}>
          <div>
            {receivingCall && !callAccepted ? (
              <div className="caller">
                <h1>{name} is calling...</h1>
                <Button
                  onClick={answerCall}
                  variant={"contained"}
                  className="answer"
                >
                  Answer
                </Button>
              </div>
            ) : null}
          </div>
        </Grid>
      </Grid>
    </>
  );
};

export default Videos;
