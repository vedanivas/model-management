const express = require("express")
const fs = require("fs")
const cors = require("cors")
const http = require("http")
const axios = require("axios")
const { Server } = require("socket.io")
const ffmpegPath = require("@ffmpeg-installer/ffmpeg")
const ffmpeg = require("fluent-ffmpeg")
const FormData = require("form-data")
const multer = require("multer")
const upload = multer({ dest: "uploads/" })
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath.path)

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:5173",
  },
});

let wake_word = false;
/* -x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x- Model Uploading related -x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x--x-x-x-x-x-x-x-x-x-x-x- */
const modelHandler = require("./model-handler")
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'models');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filePath = path.join(__dirname, 'models', file.originalname);

    // Check if a file with the same name already exists
    if (fs.existsSync(filePath)) {
      // Return an error response if the file exists
      return cb(new Error('File with the same name already exists'), null);
    }
    cb(null, file.originalname);
  }
});
const uploadModel = multer({ storage }).single('file');


app.get("/getModels", (req, res) => {
  const models = modelHandler.readModels();
  res.json(models);
})

app.post("/addModel", (req, res) => {
  uploadModel(req, res, async (err) => {
    if (err)
    {
      if (err.message === 'Model with the same name already exists') {
       return res.status(400).send('Model with the same name already exists');
      }
      else {
        return res.status(500).send('Internal Server Error');
      }
    }

    const { name, description } = req.body;
    console.log(name)
    const newModel = await  modelHandler.addModel({  name: name, description: description, model_dir: req.file.filename });
    res.status(201).send(newModel);
  })
})

app.put("/editModel/:id", (req, res) => {
  uploadModel(req, res, (err) => {
    if (err)
      {
        if (err.message === 'File with the same name already exists') {
         return res.status(400).send('File with the same name already exists');
        }
        else {
          return res.status(500).send('Internal Server Error');
        }
      }

    const { id } = req.params;
    const { name, description } = req.body;
    const updatedModel = modelHandler.editModel(id, { id: id, name: name, description: description, file: req.file });
    res.send(updatedModel);
  })
})

app.delete("/deleteModel/:id", (req, res) => {
  modelHandler.deleteModel(req.params.id);
  res.send("Model deleted successfully.");
})

app.get("/testModel", async (req, res) => {
  const model_dir = req.query.model_dir;
  console.log("Model Name: ", model_dir);
  try {
      const response = await axios.post(`http://localhost:5001/predict?model_name=${model_dir}`, { audio_path: "./test.wav" });
      console.log("Model server response:", response.data);
      res.status(200).send({ status: "success" });
  } catch (error) {
    // console.log(error);
    res.send({ status: "failed"});
  }
})

app.post("/uploadAudioToModel", upload.single("file"), async (req, res) => {
  const file = req.file;
  const model = req.body.model_name;

  if (!file) {
    return res.status(400).send("No file uploaded");
  }

  console.log("Model Name: ", model, "File: ", file);
  const outputWavPath = `./uploads/${file.filename}.wav`;

  // Convert uploaded file to wav with sampling rate 16000
  ffmpeg(file.path)
    .audioCodec("pcm_s16le")
    .audioFrequency(16000)
    .format("wav")
    .on("end", async () => {
      try {
        
        const response = await axios.post(`http://localhost:5001/predict?model_name=${model}`, { audio_path: outputWavPath });
        console.log("Model server response:", response.data);
        res.status(200).send(response.data)
      } catch (err) {
        console.error("Error making axios request:", err.message)
        res.status(500).send("Error making axios request.")
      } finally {
        fs.unlink(outputWavPath, (err) => {
          if (err) console.error("Error deleting converted file:", err)
        })
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting uploaded file:", err)
        })
      }
    })
    .on("error", (err) => {
      console.error("FFmpeg error:", err);
      res.status(500).send("Error processing file.");
    })
    .save(outputWavPath);
})

io.on("connection", (socket) => {
  console.log("Client to model connected");
  let done = false;
  socket.on("audioDataToModel", async ({ audioBlob, model }) => {
    try {
      if (done) 
        return;
      
      console.log("Model Name: ", model);
      
      if (!audioBlob || Buffer.byteLength(audioBlob) < 5000) {
        console.error("Invalid or small audio blob received");
        return;
      }
  
      const buffer = Buffer.from(audioBlob);
      const timestamp = Date.now();
      const tempFilePath = `./temp/audio_${timestamp}.webm`;
      const outputWavPath = `./temp/audio_${timestamp}.wav`;
  
      // Save the audio blob to a temporary file
      fs.writeFileSync(tempFilePath, buffer);
  
      // Convert the audio file to wav and resample to 16000 Hz
      ffmpeg(tempFilePath)
        .audioCodec("pcm_s16le")
        .audioFrequency(16000)
        .format("wav")
        .on("end", async () => {
          try {
  
            const response = await axios.post(`http://localhost:5001/predict?model_name=${model}`, { audio_path: outputWavPath });
  
            done = true;
            console.log("Model server response:", response.data);
            socket.emit("model_response", response.data);
          } catch (err) {
            console.error("Error making axios request:", err.message);
          } finally {
            fs.unlink(tempFilePath, (err) => {
              if (err) console.error("Error deleting temporary file:", err);
            });
            fs.unlink(outputWavPath, (err) => {
              if (err) console.error("Error deleting converted file:", err);
            });
          }
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err.message);
        })
        .save(outputWavPath);
    } catch (error) {
      console.error("Error processing audio data:", error.message);
    }
  });

  socket.on("stop_recording_to_model", () => {
    console.log("Recording to model stopped from front-end");
    done = false;
  });
})
/* -x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x- */

let startTime = "00:00:00.000";
let liveEndTime = "00:00:00.000";
let count = "00:00:00.000";
const incrementSeconds = 2;
const overlapTime = 0.5;
let isRecordingStopped = false;
let liveChunksProcessing = false;

let alreadyDetected = false;

// Task Queue for chunk processing
let queue = [];
let isProcessing = false;

const checkFileDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
};


function timeToSeconds(time) {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  return (
    [hours, minutes, secs]
      .map((val) => String(val).padStart(2, "0"))
      .join(":") +
    "." +
    String(millis).padStart(3, "0")
  );
}

function addSecondsToTime(time, additionalSeconds) {
  return secondsToTime(timeToSeconds(time) + additionalSeconds);
}

app.post("/upload_wav", upload.single("file"), async (req, res) => {
  const file = req.file;
  const keyword = req.body.keyword;

  if (!file) {
    return res.status(400).send("No file uploaded");
  }

  try {
    const chunksDir = `./chunks/${file.filename}`;
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir);
    }

    const outputWavPath = `./uploads/${file.filename}.wav`;

    // Convert uploaded file to wav if necessary
    ffmpeg(file.path)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("end", async () => {
        // Split the wav file into 2-second chunks
        const fileDuration = await getAudioDurationInSeconds(outputWavPath);
        let currentTime = 0;

        while (currentTime < fileDuration) {
          const chunkFilePath = `${chunksDir}/chunk_${currentTime}.wav`;
          const duration = Math.min(2, fileDuration - currentTime);

          await new Promise((resolve, reject) => {
            ffmpeg(outputWavPath)
              .setStartTime(currentTime)
              .setDuration(duration)
              .output(chunkFilePath)
              .on("end", resolve)
              .on("error", reject)
              .run();
          });

          currentTime += 2;

          // Send the chunk to the model server
          const form = new FormData();
          form.append("file", fs.createReadStream(chunkFilePath));
          try {
            const textResponse = await axios.post(
              "http://localhost:8000/get_text",
              { text: keyword }
            );
            console.log("Keyword Detection Response:", textResponse.data);
            
            const response = await axios.post(
              "http://localhost:8000/upload",
              form,
              { headers: form.getHeaders() }
            );
            console.log("Model server response:", response.data);

            if (response.data.includes("wakeword detected")) {
              io.emit("wakeword_detected_from_file", {keyword: keyword});
              break;
            }
          } catch (err) {
            console.error("Error sending chunk to model server:", err.message);
          }
          // console.log(duration);
          // Delete chunk after sending
          fs.unlink(chunkFilePath, (err) => {
            if (err) console.error("Error deleting chunk:", err);
          });
        }

        io.emit("process_completed");

        // Clean up original uploaded file
        fs.unlink(file.path, (err) => {
          if (err) console.error("Error deleting uploaded file:", err);
        });

        res.status(200).send("File processed and chunks sent successfully.");
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        res.status(500).send("Error processing file.");
      })
      .save(outputWavPath);
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).send("Error processing file.");
  }
});

async function getAudioDurationInSeconds(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

const recordingFilePath = "./temp/recording.webm";

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("audioData", async ({ audioBlob, keyword }) => {
    try {
      if (!audioBlob || Buffer.byteLength(audioBlob) < 5000) {
        console.error("Invalid or small audio blob received");
        return;
      }
      
      console.log("Keyword: ", keyword);

      liveChunksProcessing = true;
      const buffer = Buffer.from(audioBlob);
      const timestamp = Date.now();
      const outputWavPath = `./temp/audio_${timestamp}.wav`;

      // Append audio to the webm recording
      fs.appendFile(recordingFilePath, buffer, async (err) => {
        if (err) {
          console.error("Error appending to recording file:", err);
        } else {
          queue.push({ path: outputWavPath, keyword, recordingFilePath });
          await processQueue();
        }
      });
    } catch (error) {
      console.error("Error processing audio data:", error.message);
    }
  });

  socket.on("stop_recording", () => {
    console.log("Recording stopped", startTime, count);
    // console.log(liveChunksProcessing);
    isRecordingStopped = true;
    setTimeout(() => {
      if (!liveChunksProcessing) {
        processPostRecordingChunks();
      }
    }, 5000);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    resetTimes();
  });
});

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { path, keyword, recordingFilePath } = queue.shift();

  try {
    await processLiveChunk(path, keyword, recordingFilePath);
  } catch (error) {
    console.error("Error processing chunk:", error);
  } finally {
    isProcessing = false;
    if (queue.length > 0) processQueue();
  }
}

async function processLiveChunk(outputWavPath, keyword, recordingFilePath) {
  liveChunksProcessing = true;

  ffmpeg(recordingFilePath)
    .setStartTime(liveEndTime)
    .setDuration(incrementSeconds)
    .audioCodec("pcm_s16le")
    .format("wav")
    .on("end", async () => {
      liveEndTime = addSecondsToTime(liveEndTime, incrementSeconds - overlapTime);
      startTime = liveEndTime;
      count = addSecondsToTime(count, incrementSeconds);

      try {
        const duration = await checkFileDuration(outputWavPath);
        // console.log("duration: ", duration);
        if (duration === 0) {
          console.log("Zero-second audio file detected. Skipping processing.");
          fs.unlinkSync(outputWavPath);
          return;
        }

        const form = new FormData();
        form.append("file", fs.createReadStream(outputWavPath));

        const textResponse = await axios.post(
          "http://localhost:8000/get_text",
          { text: keyword }
        );
        console.log("Keyword Detection Response:", textResponse.data);

        const audioResponse = await axios.post(
          "http://localhost:8000/upload",
          form,
          { headers: { ...form.getHeaders() } }
        );
        console.log("ML Model Response:", audioResponse.data);

        if (audioResponse.data.includes("wakeword detected")) {
          io.emit("stop_recording", { keyword: keyword });
          alreadyDetected = true;
        }
      } catch (err) {
        console.error("Error processing live chunk:", err);
      } finally {
        liveChunksProcessing = false;
        fs.unlink(outputWavPath, (err) => {
          if (err) console.error("Error deleting file:", err);
          else console.log(`File deleted: ${outputWavPath}`);
        });
      }
    })
    .on("error", (err) => {
      console.error("FFmpeg Error:", err.message);
      liveChunksProcessing = false;
    })
    .save(outputWavPath);
}

async function processPostRecordingChunks() {
  console.log("Processing post-recording chunks...");

  if (timeToSeconds(startTime) >= timeToSeconds(count)) {
    io.emit("process_completed");
  }

  while (timeToSeconds(startTime) < timeToSeconds(count)) {
    const timestamp = Date.now();
    const outputWavPath = `./temp/audio_${timestamp}.wav`;
    const remainingTime = timeToSeconds(count) - timeToSeconds(startTime);
    const duration = Math.min(Math.max(remainingTime, 0.1), incrementSeconds);

    await new Promise((resolve, reject) => {
      ffmpeg(recordingFilePath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec("pcm_s16le")
        .format("wav")
        .on("end", async () => {
          startTime = addSecondsToTime(startTime, incrementSeconds - overlapTime);

          try {
            const duration = await checkFileDuration(outputWavPath);
            // console.log("duration: ", duration);
            if (duration === 0) {
              console.log("Zero-second audio file detected. Skipping processing.");
              fs.unlinkSync(outputWavPath);
              return;
            }

            const form = new FormData();
            form.append("file", fs.createReadStream(outputWavPath));

            if (!alreadyDetected){
              const audioResponse = await axios.post(
                "http://localhost:8000/upload",
                form,
                { headers: { ...form.getHeaders() } }
              );
              console.log("ML Model Response:", audioResponse.data);

              if (audioResponse.data.includes("wakeword detected")) {
                io.emit("wakeword_detected");
                alreadyDetected = true;
              }
          }
          } catch (err) {
            console.error("Error sending post-recording chunk:", err.message);
          } finally {
            fs.unlink(outputWavPath, (err) => {
              if (err) console.error("Error deleting post-recording chunk:", err.message);
              else console.log(`Post-recording chunk deleted: ${outputWavPath}`);
            });
          }

          resolve();
        })
        .on("error", (err) => {
          console.error("FFmpeg Error:", err.message);
          reject(err);
        })
        .save(outputWavPath);
    });
  }

  fs.access(recordingFilePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(recordingFilePath, (err) => {
        if (err) console.error("Error deleting recording file:", err);
        else console.log("Recording file deleted successfully");
      });
    } else {
      console.log("Recording file not found");
    }
  });

  resetTimes();
}

function resetTimes() {
  startTime = "00:00:00.000";
  liveEndTime = "00:00:00.000";
  count = "00:00:00.000";
  isRecordingStopped = false;
}

const PORT = 5050;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});