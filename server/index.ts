// server index.jskjh

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multiparty from 'multiparty';
import path from 'path';
import fse from 'fs-extra';

const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const app = express();
const HOSTNAME = 'http://127.0.0.1:8888';
app.use(express.json());
app.use(cors());
// 1. 读你要改变的内容
// 2. 创建需要改写的内容
// 3.可读 pipe() 到 可写 readStream.pipe(writeStream);

const UPLOAD_DIR = path.resolve(__dirname, '..', 'temporary');
const extractExt = (filename: string) =>
  filename.slice(filename.lastIndexOf('.'), filename.length);
// 写入文件流
const pipeStream = (path: any, writeStream: any) =>
  // 管道的数据传输是异步的，因此我们不能简单地在函数中使用回调函数来处理操作完成的事件。相反，我们使用 Promise 对象来表示这个异步操作的状态，并在操作完成时通过 resolve() 方法将 Promise 对象解决为一个值。
  // 这段代码中的异步操作是将一个文件流的数据复制到另一个文件流中，并在复制完成后删除原始文件。这个操作需要等待数据传输完成才能执行删除文件的操作。因此，必须等待复制数据的异步操作完成后再执行删除文件的操作。如果没有使用 Promise 对象，我们就不能确定何时可以执行删除操作。
  new Promise<void>((resolve, reject) => {
    const readStream = fse.createReadStream(path);
    readStream.on('end', () => {
      try {
        // 删除原始文件
        fse.unlinkSync(path);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    readStream.pipe(writeStream);
  });
// 合并切片
const mergeFileChunk = async (filePath: any, filename: any, size: any) => {
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + filename);
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  // 否则直接读取目录的获得的顺序会错乱
  chunkPaths.sort(
    (a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
  );
  console.log('chunkPaths', chunkPaths);

  // 并发写入文件
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        // chunkDir - 分片目录
        // chunkPath - 分片目录下的分片文件
        path.resolve(chunkDir, chunkPath),
        // 根据 size 在指定位置创建可写流
        fse.createWriteStream(filePath, {
          // 指定写入文件的起始位置, 写入流会自动根据写入数据的长度来计算结束位置
          start: index * size,
        })
      )
    )
  );
  // 合并后删除保存切片的目录
  fse.rmdirSync(chunkDir);
};

const multiparty_upload = function multiparty_upload(req: any) {
  return new Promise(async (resolve, reject) => {
    new multiparty.Form().parse(req, async (err, fields, files) => {
      console.log('fields', fields);
      console.log('files', files);

      if (err) {
        reject(err);
        return;
      }

      const [chunk] = files.chunk;
      const [hash] = fields.hash;
      const [filename] = fields.filename;
      const chunkFileName = hash.split('-')[0];
      console.log('chunk', chunk);

      // 切片文件夹名
      const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + chunkFileName);

      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }
      // 把分片移动到对应的目录下
      await fse.move(chunk.path, `${chunkDir}/${hash}`);
      resolve({ code: 0, codeText: 'upload success' });
    });
  });
};

// 文件上传
app.post('/upload_single', async (req, res) => {
  try {
    await multiparty_upload(req);
    res.send({
      code: 0,
      codeText: 'upload success',
    });
  } catch (err) {
    res.send({
      code: 1,
      codeText: err,
    });
  }
});

// 通知是否进行文件合并
app.post('/merge', async (req, res) => {
  try {
    const { filename, size, fileHash } = req.body || {};
    const ext = extractExt(filename);
    // 是要合并的文件的最终位置
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
    await mergeFileChunk(filePath, filename, size);
    res.send({
      code: 0,
      message: 'file merged success',
    });
  } catch (error) {
    res.send({
      code: 1,
      message: 'file merged failed',
    });
  }
});

// 返回已上传的所有切片名
const createUploadedList = async (fileHash: string) => {
  console.log('fileHashfileHashfileHashfileHash', fileHash);
  console.log(
    'fse.existsSync(path.resolve(UPLOAD_DIR',
    fse.existsSync(path.resolve(UPLOAD_DIR, 'chunkDir' + fileHash))
  );
  console.log(
    'fse.readdir(path.resolve(UPLOAD_DIR',
    await fse.readdir(path.resolve(UPLOAD_DIR, 'chunkDir' + fileHash))
  );

  return fse.existsSync(path.resolve(UPLOAD_DIR, 'chunkDir' + fileHash))
    ? await fse.readdir(path.resolve(UPLOAD_DIR, 'chunkDir' + fileHash))
    : [];
};

// 确认文件是否上传过(秒传)
app.post('/verify_upload', async (req, res) => {
  try {
    const { fileName, fileHash } = req.body;
    const ext = extractExt(fileName);
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
    console.log('fse.existsSync(filePath)', fse.existsSync(filePath));
    // 文件是否已经合并
    if (fse.existsSync(filePath)) {
      res.send({
        code: 0,
        shouldUpload: false,
        message: 'has uploaded',
      });
    } else {
      const uploadedList = await createUploadedList(fileHash);
      console.log('uploadedList', uploadedList);
      res.send({
        code: 1,
        shouldUpload: true,
        message: 'has not uploaded and reload',
        uploadedList,
      });
    }
  } catch (error) {
    res.send({
      code: 3,
      shouldUpload: true,
      message: 'error',
    });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
