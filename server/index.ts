import express from "express";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";
import multiparty from "multiparty";

interface MultipartyUploadConfig {
  uploadDir: string;
}

const urlencodedParser = bodyParser.urlencoded({ extended: false });
const app = express();
const HOSTNAME = "http://127.0.0.1:8888";
app.use(express.json());
app.use(cors());

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms :POST")
);

const delay = function delay(interval?: any) {
  typeof interval !== "number" ? (interval = 1000) : null;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, interval);
  });
};

const uploadDir = `${__dirname}/upload`;
const multiparty_upload = function multiparty_upload(req: any, auto: any) {
  typeof auto !== "boolean" ? (auto = false) : null;
  let config: MultipartyUploadConfig = { uploadDir: "" };
  //传到指定的目录下，通过插件处理文件名，自动编译成新的名字
  if (auto) {
    config.uploadDir = uploadDir;
  }
  return new Promise(async (resolve, reject) => {
    await delay();
    new multiparty.Form(config).parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

app.post("/upload_single", async (req, res) => {
  try {
    // @ts-ignore
    let { fields, files } = await multiparty_upload(req, true);
    console.log("files.file[0]", files.file[0]);
    console.log("files", files);
    console.log("fields", fields);
    let file = (files.file && files.file[0]) || {};
    res.send({
      code: 0,
      codeText: "upload success",
      originalFilename: file.originalFilename,
      servicePath: file.path.replace(__dirname, HOSTNAME),
    });
  } catch (err) {
    console.log("err", err);
    res.send({
      code: 1,
      codeText: err,
    });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
