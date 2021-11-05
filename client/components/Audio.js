import React, { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Peer from "simple-peer";
import io from "socket.io-client";
import { Button, IconButton, TextField, Grid, Paper } from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";
import Videos from './Videos';

// const socket = io.connect('https://rig-zig.herokuapp.com/');
const socket = io.connect("http://localhost:8080");

const Audio = () => {
  const [stream, setStream] = useState();
  const [volumeValue, setVolumeValue] = useState("1");
  const [preampDriveValue, setPreampDriveValue] = useState("100");
  const [bassValue, setBassValue] = useState("-10");
  const [midValue, setMidValue] = useState("8");
  const [trebleValue, setTrebleValue] = useState("9");
  const [driveValue, setDriveValue] = useState("150");
  const [trebleNode, setTrebleNode] = useState();
  const [streamSource, setStreamSource] = useState();
  const [streamDestination, setStreamDestination] = useState();

  const makePreAmpCurve = () => {
    let curve = new Float32Array(44100),
      x;
    for (let i = 0; i < 44100; i++) {
      x = -1 + (2 * i) / 44100;
      curve[i] = (2 * x) / 1 + x ** 4;
    }
    return curve;
  };
  const pulseCurve = () => {
    let curve = new Float32Array(44100);
    for (let i = 0; i < 44100; i++) {
      let x = -1 + (2 * i) / 44100;
      curve[i] = Math.tanh(x);
    }
    return curve;
  };
  const makePreampDriveCurve = (amount) => {
    let k = typeof amount === "number" ? amount : 2,
      n_samples = 12050,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for (; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 15 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };
  const makeDriveCurve = (amount) => {
    let k = typeof amount === "number" ? amount : 2,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for (; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 3 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };
  const handleChangeVolume = (event) => {
    setVolumeValue(event.target.value);
  };
  const handleChangePreamp = (event) => {
    setPreampDriveValue(event.target.value);
  };
  const handleChangeBass = (event) => {
    setBassValue(event.target.value);
  };
  const handleChangeMid = (event) => {
    setMidValue(event.target.value);
  };
  const handleChangeTreble = (event) => {
    setTrebleValue(event.target.value);
    setTrebleNode({gain: event.target.value});
  };
  const handleChangeDrive = (event) => {
    setDriveValue(event.target.value);
  };
  let localStream;
  /**
   * Create audio context and stream source on initial mount
   */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
        }
      })
      .then((stream) => {
        console.log('stream', stream)
        console.log('hello')
        const videoTracks = stream.getVideoTracks();
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const mediaStreamDestination = context.createMediaStreamDestination();
        const gainNode = new GainNode(context, { gain: 2 * 1 });

        // compression - static value
        const compression = new GainNode(context, { gain: 1 });
        compression.curve = makePreAmpCurve();
        compression.oversample = "6x";

        // preamp - static value
        const preamp = context.createWaveShaper();
        preamp.curve = pulseCurve();

        // preampDrive - variable
        const preampDrive = context.createWaveShaper();
        preampDrive.curve = makePreampDriveCurve(preampDriveValue * 1);
        preampDrive.oversample = "4x";

        const bassEQ = new BiquadFilterNode(context, {
          type: "lowshelf",
          frequency: 600,
          gain: bassValue * 1,
        });
        const midEQ = new BiquadFilterNode(context, {
          type: "peaking",
          Q: Math.SQRT1_2,
          frequency: 1500,
          gain: midValue * 1,
        });
        const trebleEQ = new BiquadFilterNode(context, {
          type: "highshelf",
          frequency: 3000,
          gain: trebleValue * 1,
        });

        // setTrebleNode(trebleEQ);
        // Overdrive - variable
        const driveEQ = context.createWaveShaper();
        driveEQ.curve = makeDriveCurve(driveValue * 1);
        driveEQ.oversample = '4x';

        source
        .connect(compression)
        .connect(preamp)
        .connect(preampDrive)
        .connect(trebleEQ)
        .connect(bassEQ)
        .connect(midEQ)
        .connect(gainNode)
        .connect(driveEQ)
        .connect(mediaStreamDestination);
        console.log(trebleNode)
        const controlledStream = mediaStreamDestination.stream;
        for (const videoTrack of videoTracks) {
            controlledStream.addTrack(videoTrack);
          }
        localStream = controlledStream;
        setStream(controlledStream);
      });
  }, [])

  return (
    <>
      <h1>Zig and Zag</h1>    

      <label htmlFor="volumeRange">Volume</label>
      <input
        type="range"
        min="0"
        max="4"
        value={volumeValue}
        step=".1"
        id="volumeRange"
        onChange={handleChangeVolume}
      ></input>

      <label htmlFor="preampDriveRange">Pre-Amp</label>
      <input
        type="range"
        min="0"
        max="100"
        value={preampDriveValue}
        step="2"
        id="preampDriveRange"
        onChange={handleChangePreamp}
      ></input>

      <label htmlFor="bassRange">Bass</label>
      <input
        type="range"
        min="-15"
        max="9"
        value={bassValue}
        id="bassRange"
        onChange={handleChangeBass}
      ></input>

      <label htmlFor="midRange">Mid</label>
      <input
        type="range"
        min="-10"
        max="100"
        value={midValue}
        id="midRange"
        onChange={handleChangeMid}
      ></input>

      <label htmlFor="trebleRange">Treble</label>
      <input
        type="range"
        min="-10"
        max="100"
        value={trebleValue}
        id="trebleRange"
        onChange={handleChangeTreble}
      ></input>

      <label htmlFor="driveRange">Overdrive</label>
      <input
        type="range"
        min="0"
        max="150"
        value={driveValue}
        id="driveRange"
        onChange={handleChangeDrive}
      ></input>
      <Videos stream={stream} />
    </>
  );
};

export default Audio;
