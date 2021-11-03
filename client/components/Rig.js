import React, { useEffect, useRef, useState } from "react";
import { Button, IconButton, TextField, Box, Slider } from "@mui/material";

// const socket = io.connect('https://peer-pedalboard.herokuapp.com/');
// const socket = io.connect('http://localhost:8080');

const Rig = () => {
  const [ stream, setStream ] = useState();
  const [volumeValue, setVolumeValue] = useState("1");
  const [preampDriveValue, setPreampDriveValue] = useState("10");
  const [bassValue, setBassValue] = useState("-10");
  const [midValue, setMidValue] = useState("8");
  const [trebleValue, setTrebleValue] = useState("9");
  const [driveValue, setDriveValue] = useState("50");

  function valuetext(value) {
    return `${value}`;
  }

  const VolumeMarks = [
    {
      value: 0,
      label: "0",
    },
    {
      value: 4,
      label: "4db",
    },
  ];
  const PreampMarks = [
    {
      value: 0,
      label: "0",
    },
    {
      value: 100,
      label: "100",
    },
  ];
  const BassMarks = [
    {
      value: -15,
      label: "-15",
    },
    {
      value: 9,
      label: "9",
    },
  ];
  const MidMarks = [
    {
      value: -10,
      label: "-10",
    },
    {
      value: 10,
      label: "10",
    },
  ];
  const TrebleMarks = [
    {
      value: -10,
      label: "-10",
    },
    {
      value: 10,
      label: "10",
    },
  ];
  const OverdriveMarks = [
    {
      value: 0,
      label: "0",
    },
    {
      value: 150,
      label: "150",
    },
  ];

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
  };
  const handleChangeDrive = (event) => {
    setDriveValue(event.target.value);
  };

  let localStream;

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0,
        },
      })
      .then((stream) => {
        /**
         * The stream object contains both video and audio. I need to affect the audio with Web Audio API.
         * Store the video track in a variable, and then merge the video and audio back at the end.
         */

        const videoTracks = stream.getVideoTracks();
        /**
         * Create new audio context and build a stream source,
         * stream destination, and the guitar effects rig built with the Web Audio API.
         * Pass the stream into the mediaStreamSource to use it in the guitar rig, built with Web Audio API.
         * --- insert context here ----
         */
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const mediaStreamDestination = context.createMediaStreamDestination();

        // gain stuff - v
        // gainNode AKA Volume - variable
        const gainNode = new GainNode(context, { gain: volumeValue * 1 });

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

        // Overdrive - variable
        const driveEQ = context.createWaveShaper();
        driveEQ.curve = makeDriveCurve(driveValue * 1);
        // driveEQ.oversample = '1x';
        // still need the gain node one here ^

        /**
         * Connect the stream to the Web Audio API nodes.
         * Pass in all audio to be controlled by the effects.
         * Then, pass the controlled stream to the mediaStreamDestination,
         * which is then passed back to the RTC client.
         */

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

        /**
         * The mediaStreamDestination.stream will output a MediaStream object
         * containing a single AudioMediaStreamTrack.
         * Add the video track to the new stream to rejoin the video with the controlled audio.
         */

        const controlledStream = mediaStreamDestination.stream;
        for (const videoTrack of videoTracks) {
          controlledStream.addTrack(videoTrack);
        }

        /**
         * Use the stream that went through the Web Audio API node effect chain.
         */

        localStream = controlledStream;
        setStream(controlledStream);
      });
  }, [
    volumeValue,
    preampDriveValue,
    bassValue,
    midValue,
    trebleValue,
    driveValue,
  ]);

  return (
    <>
      <h1>Guitar Rig</h1>
      <Box sx={{ width: 300 }}>
        <h2>Volume</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={volumeValue * 1}
          getAriaValueText={valuetext}
          step={.1}
          marks={VolumeMarks}
          valueLabelDisplay="on"
          onChange={handleChangeVolume}
        />
      </Box>
      <Box sx={{ width: 300 }}>
        <h2>Pre-Amp</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={preampDriveValue * 1}
          getAriaValueText={valuetext}
          step={2}
          marks={PreampMarks}
          valueLabelDisplay="on"
          onChange={handleChangePreamp}
        />
      </Box>
      <Box sx={{ width: 300 }}>
        <h2>Bass</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={bassValue * 1}
          getAriaValueText={valuetext}
          step={1}
          marks={BassMarks}
          valueLabelDisplay="on"
          onChange={handleChangeBass}
        />
      </Box>
      <Box sx={{ width: 300 }}>
        <h2>Mid</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={midValue * 1}
          getAriaValueText={valuetext}
          step={1}
          marks={MidMarks}
          valueLabelDisplay="on"
          onChange={handleChangeMid}
        />
      </Box>
      <Box sx={{ width: 300 }}>
        <h2>Treble</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={trebleValue * 1}
          getAriaValueText={valuetext}
          step={10}
          marks={TrebleMarks}
          valueLabelDisplay="on"
          onChange={handleChangeTreble}
        />
      </Box>
      <Box sx={{ width: 300 }}>
        <h2>Overdrive</h2>
        <br />
        <Slider
          aria-label="Always visible"
          value={driveValue * 1}
          getAriaValueText={valuetext}
          step={10}
          marks={OverdriveMarks}
          valueLabelDisplay="on"
          onChange={handleChangeDrive}
        />
      </Box>

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
        max="10"
        value={midValue}
        id="midRange"
        onChange={handleChangeMid}
      ></input>

      <label htmlFor="trebleRange">Treble</label>
      <input
        type="range"
        min="-10"
        max="10"
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
    </>
  );
};

export default Rig;
