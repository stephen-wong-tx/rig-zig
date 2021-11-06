import React, { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Peer from "simple-peer";
import io from "socket.io-client";
import { Button, IconButton, TextField, Grid, Paper } from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhoneIcon from "@mui/icons-material/Phone";
import Videos from "./Videos";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

// const socket = io.connect('https://rig-zig.herokuapp.com/');
const socket = io.connect("http://localhost:8080");

class AudioClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      volumeValue: "1",
      preampDriveValue: "40",
      bassValue: "-10",
      midValue: "8",
      trebleValue: "9",
      driveValue: "10",
      stream: null,
      volumeNode: null,
      preampDriveNode: null,
      bassNode: null,
    };
    this.handleChangeVolume = this.handleChangeVolume.bind(this);
    // this.handleChangePreampDrive = this.handleChangePreampDrive(this);
    this.makePreAmpCurve = this.makePreAmpCurve.bind(this);
    this.pulseCurve = this.pulseCurve.bind(this);
    // this.makePreampDriveCurve = this.makePreampDriveCurve(this);
  }
  makePreAmpCurve() {
    let curve = new Float32Array(44100),
      x;
    for (let i = 0; i < 44100; i++) {
      x = -1 + (2 * i) / 44100;
      curve[i] = (2 * x) / 1 + x ** 4;
    }
    return curve;
  }
  pulseCurve() {
    let curve = new Float32Array(44100);
    for (let i = 0; i < 44100; i++) {
      let x = -1 + (2 * i) / 44100;
      curve[i] = Math.tanh(x);
    }
    return curve;
  }
  makePreampDriveCurve(amount) {
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
  }
  makeOverdriveCurve(amount) {
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
  }

  async componentDidMount() {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
          // channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        },
      })
      .then((stream) => {
        console.log("stream", stream);

        const videoTracks = stream.getVideoTracks();
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const mediaStreamDestination = context.createMediaStreamDestination();

        // Volume
        const gainNode = new GainNode(context, {
          gain: this.state.volumeValue * 1,
        });
        this.setState({ volumeNode: gainNode });

        // Compression & PreAmp
        const compression = new GainNode(context, { gain: 1 });
        compression.curve = this.makePreAmpCurve();
        compression.oversample = "6x";

        const preamp = context.createWaveShaper();
        preamp.curve = this.pulseCurve();

        // PreAmp gain
        const preampDrive = context.createWaveShaper();
        preampDrive.curve = this.makePreampDriveCurve(
          this.state.preampDriveValue * 1
        );
        preampDrive.oversample = "4x";
        this.setState({ preampDriveNode: preampDrive });

        const bassEQ = new BiquadFilterNode(context, {
          type: "lowshelf",
          frequency: 500,
          gain: this.state.bassValue,
        });
        const midEQ = new BiquadFilterNode(context, {
          type: "peaking",
          Q: Math.SQRT1_2,
          frequency: 1500,
          gain: this.state.midValue,
        });
        const trebleEQ = new BiquadFilterNode(context, {
          type: "highshelf",
          frequency: 3000,
          gain: this.state.trebleValue,
        });
        const overdriveInput = new GainNode(context, {
          gain: this.state.driveValue * 1,
        });
        const overdriveEQ = context.createWaveShaper();
        overdriveEQ.curve = this.makeOverdriveCurve(this.state.driveValue * 1);
        overdriveEQ.oversample = '1x'

        source
          .connect(compression)
          .connect(preamp)
          .connect(this.state.preampDriveNode)
          .connect(bassEQ)
          .connect(midEQ)
          .connect(trebleEQ)
          .connect(overdriveEQ)
          .connect(this.state.volumeNode)
          .connect(mediaStreamDestination);

        const controlledStream = mediaStreamDestination.stream;

        for (const videoTrack of videoTracks) {
          controlledStream.addTrack(videoTrack);
        }

        this.setState({ stream: controlledStream });
      });
  }

  changeVolume(value) {
    this.setState({ volumeValue: value });
  }

  changePreamp(value) {
    this.setState({ preampDriveValue: value });
  }

  // changeBass(value) {
  //   this.setState({ bassValue: value });
  // }

  async handleChangeVolume(event) {
    let newValue = event.target.value;
    await this.changeVolume(event.target.value);
    // console.log(this.state.volumeNode);

    let volumeNode = this.state.volumeNode;
    volumeNode.gain.value = newValue;
    console.log("hello volumeNode", volumeNode);
    volumeNode.gain.value = newValue;

    await this.setState({ volumeNode });
  }

  async handleChangePreamp(event) {
    await this.changePreamp(event.target.value);

    this.state.preampDriveNode.preampDrive.curve = this.makePreampDriveCurve(
      event.target.value * 1
    );
    this.state.preampDriveNode.preampDrive.oversample = "x4";
  }

  // async handleChangeBass(event) {
  //   let newValue = event.target.value;
  //   await this.changeBass(event.target.value);
  //   let bassNode = this.state.bassNode;
  //   bassNode.gain.value = newValue;
  // }

  // handleChangePreampDrive(event){
  //   // let newValue = event.target.value;
  //   let preampDriveValue = this.state.preampDriveValue + 1
  //   this.setState({preampDriveValue})
  //   // this.setState({ preampDriveValue: event.target.value });

  //   // this.setState({ preampDriveValue: event.target.value });
  //   // console.log(this.state.preampDriveNode);

  //   // let preampDriveNode = this.state.preampDriveNode;
  //   // preampDriveNode.curve = this.makePreampDriveCurve(this.state.preampDriveValue * 1);
  //   // preampDriveNode.oversample = "4x";

  //   // await this.setState({ preampDriveNode });
  // }

  // handleMid(event){
  //   event.persist()
  //   let newValue = event.target.value;
  //   this.changeMid(newValue)
  // }

  render() {
    const { handleChangeVolume, handleChangePreamp } = this;
    const {
      volumeValue,
      stream,
      volumeNode,
      preampDriveValue,
      midValue,
      bassValue,
    } = this.state;
    return (
      <>
        <div id="volume">
        <label htmlFor="volumeRange"><VolumeUpIcon /> Volume</label>
        <input
          type="range"
          min="0"
          max="4"
          value={volumeValue}
          step=".1"
          id="volumeRange"
          onChange={handleChangeVolume}
        ></input>
        </div>

        {/* <label htmlFor="bassRange">Bass Level</label>
        <input
          type="range"
          min="-10"
          max="9"
          value={bassValue}
          step="1"
          id="bassRange"
          onChange={handleChangePreamp(bassValue)}
        ></input> */}
        {/* <label htmlFor="hi">hi</label>
        <input
          type="range"
          min="0"
          max="100"
          value={midValue}
          step="2"
          id="preampDriveRange"
          onChange={handleMid}

        ></input>         */}

        <Videos stream={stream} />
      </>
    );
  }
}

export default AudioClass;
