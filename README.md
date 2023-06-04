# 大文件上传

1. 需求文档

https://vt7y72vnyl.feishu.cn/wiki/wikcnhiYRV1LCdHioeVc7RdVadb

2. 仓库

https://vt7y72vnyl.feishu.cn/wiki/wikcnhiYRV1LCdHioeVc7RdVadb

# 设计方案

## 整体思路

### 前端

1. 分片上传：将大文件分成较小的片段进行上传，这样可以减少单个请求的数据量，提高上传的稳定性和可靠性。前端可以使用 JavaScript 库（如`resumable.js`）来处理分片上传，它可以管理分片上传的进度、重试失败的片段等。
2. 进度条显示：为了提供更好的用户体验，可以在界面上显示一个进度条，实时显示文件上传的进度。
3. 断点续传：如果文件上传过程中断，用户可以选择继续上传，而不需要重新开始上传整个文件。
4. 并发上传：对于支持多线程上传的浏览器，可以同时上传多个分片，从而提高上传速度。通过 JavaScript 的`Web Workers`来实现并发上传，每个`Web Worker`处理一个分片的上传。

### 后端

1. 接收分片：后端需要提供一个接口来接收上传的文件分片。该接口应该支持接收分片数据、验证分片的完整性、保存分片数据等操作。
2. 存储分片：后端可以选择将分片数据存储在文件系统或数据库中。如果选择文件系统存储，可以按照文件的唯一标识或文件名创建目录和文件来存储分片数据。如果选择数据库存储，可以使用表来保存分片数据，并在表中添加一列用于标识文件的唯一标识或文件名。（此项目选择存储在文件系统中）
3. 断点续传支持：为了支持断点续传，后端记录已上传的分片信息，以便在上传过程中断后能够从中断处继续上传。可以使用数据库或缓存来存储已上传的分片信息，例如记录已上传的分片序号或标识。
4. 合并分片：当所有分片上传完成后，后端需要将这些分片合并成完整的文件。可以根据分片的序号或标识按顺序读取和合并分片数据，最终生成完整的文件。

## 前端模块

### 上传控制

```jsx
 <div className='chooseContainer'>
   <input type='file' onChange={handleFileChange} />
   <div className='buttonGroup'>
     <Button type='primary' onClick={handleFileUpload}>
       上传
     </Button>
     <Button type='primary' onClick={handlePause}>
       暂停
     </Button>
     <Button type='primary' onClick={handleReupload}>
       重新上传
     </Button>
   </div>
 </div>
const [file, setUploadFile] = useState<File | null>(null);

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 // 单个文件上传
 const file: File = (e.target.files as FileList)[0];
 if (!file) {
   alert('请上传文件');
 }
 setUploadFile(file);
};

// 点击文件上传
const handleFileUpload = async () => {
 if (!file) return;
 const list = createFileChunksWithHash(file); // 创建文件切片
 const allChunkFilesHash = await calculateHash(list); // 计算所有切片的hash
 list.map((x, idx) => (x.fileHash = `${allChunkFilesHash}-${idx}`));

 setFileHash(allChunkFilesHash);
 setFileChunkList(list);

 await handleUpload(file, allChunkFilesHash, list, rspUploadedLists);
};
```

### 上传请求逻辑

```js
  /**
   * 创建文件上传请求
   * @param fileChunkList 文件切片数组
   * @param uploadedLists 已经上传成功的文件切片
   * @param createProgressHandler 回调函数，用于创建处理上传进度的函数
   * @param cancelToken axios.CancelToken 对象，用于取消当前请求
   * @returns Promise
   */
  const createRequestList = (
    fileChunkList: fileChunks[],
    uploadedLists: string[],
    createProgressHandler: (arg0: any) => any,
    cancelToken?: any
  ) => {
    return fileChunkList
      .filter(({ fileHash }) => !uploadedLists.includes(fileHash))
      .map(({ chunk, index, fileHash, hash }) => {
        let formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', fileHash);
        formData.append('filename', file!.name);
        return { formData, index };
      })
      .map(({ formData, index }) => {
        const config = {
  // onUploadProgress 参数表示上传进度变化时的回调函数，该函数通过调用 createProgressHandler 函数生成，以便实现对不同文件分块上传进度的监控
          onUploadProgress: createProgressHandler(index),
          cancelToken,
        };
        const request = http.post('/upload_single', formData, config);
        return request;
      });
  };
```

### 文件切片处理

1. 前端获取到上传文件后，通过`file.slice`对文件进行切片
   此处`fileHash`初始化为空字符串，方便之后通过 md5 生成 hash 值的时候方便添加属性

```js
// 生成文件切片
/**
 *
 * @param file 待上传文件
 * @param size 文件切片大小
 * @returns 文件切片数组
 */
function createFileChunksWithHash(file: File, size = SIZE) {
  const fileChunks: fileChunks[] = [];
  for (let cur = 0, index = 0; cur < file.size; index++) {
    const fileChunk = file.slice(cur, cur + size);
    fileChunks.push({
      chunk: fileChunk,
      index,
      percentage: 0,
      fileHash: '',
    });
    cur += size;
  }
  return fileChunks;
}
```

2. 利用 webworker 和 md5 根据文件内容生成 hash

   > spark-md5 文档中要求传入所有切片并算出 hash 值，不能直接将整个文件放入计算，否则即使不同文件也会有相同的 hash

```js
// 计算所有切片的hash
const calculateHash = (fileChunkList: fileChunks[]): Promise<string> => {
  return new Promise((resolve) => {
    worker.postMessage({ fileChunkList });
    worker.onmessage = (e) => {
      const { hash } = e.data;
      if (hash) {
        resolve(hash);
      }
    };
  });
};
/* eslint-disable no-restricted-globals */
self.importScripts('/spark-md5.min.js');

// self.onmessage = event => {
//   console.log('event.dataevent.dataevent.data', event.data);
//   const result = event.data * 2;
//   self.postMessage(result);
// };

self.onmessage = (e) => {
  const { fileChunkList } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percentage = 0;
  let count = 0;
  const loadNext = (index) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(fileChunkList[index].chunk);
    reader.onload = (e) => {
      count++;
      spark.append(e.target.result);
      if (count === fileChunkList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end(),
        });
        self.close();
      } else {
        percentage += 100 / fileChunkList.length;
        self.postMessage({
          percentage,
        }); // calculate recursively
        loadNext(count);
      }
    };
  };
  loadNext(0);
};
```

3. 将获取到的切片 hash，添加到文件切片属性中
   给每个切片初始化的`fileHash`，更改为 md5 生成的 hash + 下标，这样后端可以知道当前切片是第几个切片，用于之后的合并切片

```js
const list = createFileChunksWithHash(file); // 创建文件切片
const allChunkFilesHash = await calculateHash(list); // 计算所有切片的hash
list.map((x, idx) => (x.fileHash = `${allChunkFilesHash}-${idx}`));
```

### 切片上传

```js
const [source, setSource] = useState(http.CancelToken.source());
/**
 * 文件上传/重新上传
 * @param file 待上传的文件对象
 * @param fileHash 文件的哈希值
 * @param fileChunkList 文件分片的数组
 * @param uploadedLists 已上传成功的文件切片
 * @returns
 */
const handleUpload = async (
  file: File,
  fileHash: string,
  fileChunkList: fileChunks[],
  uploadedLists: string[] | undefined
) => {
  try {
    // 确认分片或者文件是否已经上传
    const {
      shouldUpload,
      uploadedList,
      message: isUploadedMessage,
    } = await isUploaded(file.name, fileHash);

    setRspUploadedList(uploadedList);

    if (!shouldUpload) {
      alert(isUploadedMessage);
      return;
    }

    const requestList = createRequestList(
      fileChunkList,
      uploadedLists ? uploadedLists : uploadedList,
      createProgressHandler,
      source.token
    );

    await Promise.all(requestList);

    const {
      data: { message },
    } = await mergeRequest(fileHash);

    if (message) {
      alert(message);
      return;
    }
  } catch (error) {
    if (http.isCancel(error)) {
      console.log('请求被取消：', error);
    } else {
      console.error('上传文件出错：', error);
    }
  }
};
```

### 发送合并请求

前端主动通知服务端进行合并，发送额外的合并请求，服务端接受到请求时合并切片

```js
// 分片上传后，触发合并请求
/**
 *
 * @param allChunkFilesHash md5计算后的分片hash
 * @returns
 */
const mergeRequest = async (
  allChunkFilesHash: string
): Promise<{ code: number, message: string }> => {
  const { data } = await http.post(
    '/merge',
    JSON.stringify({
      size: SIZE,
      filename: file?.name,
      fileHash: allChunkFilesHash,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return data;
};
```

## 后端模块

### 接收上传切片

```js
const multiparty_upload = function multiparty_upload(req: any) {
  return new Promise(async (resolve, reject) => {
    new multiparty.Form().parse(req, async (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const [chunk] = files.chunk;
      const [hash] = fields.hash;
      const chunkFileName = hash.split('-')[0];

      // 切片文件夹名
      const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + chunkFileName);

      // 如果chunkDir指定的目录不存在，则使用fse.mkdirs方法创建该目录
      if (!fse.existsSync(chunkDir)) {
        await fse.mkdirs(chunkDir);
      }
      // 把分片移动到对应的目录下，使用fse.move方法将分片文件从临时路径chunk.path移动到切片文件夹chunkDir中，并以hash作为文件夹名。
      await fse.move(chunk.path, `${chunkDir}/${hash}`);
      resolve({ code: 0, codeText: 'upload success' });
    });
  });
};
```

### 合并切片

将文件分片按顺序合并到目标文件中，并在完成后删除切片文件和目录。

```js
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
const mergeFileChunk = async (
  filePath: string,
  fileHash: string,
  size: number
) => {
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + fileHash);
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据切片下标进行排序
  // 否则直接读取目录的获得的顺序会错乱
  chunkPaths.sort(
    (a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
  );
  // 并发写入文件
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        // chunkDir - 分片目录/分片文件夹
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
```

`pipeStream`函数：该函数用于将一个文件流的数据复制到另一个文件流中，并在复制完成后删除原始文件。

函数接收两个参数：`path`表示原始文件的路径，`writeStream`表示目标文件流的写入流。

- 在函数内部，首先使用`fse.createReadStream`创建一个读取流`readStream`，读取原始文件的数据。
- `readStream`的`'end'`事件监听器会在数据读取完成后触发，此时执行回调函数。
- 在回调函数中，使用`fse.unlinkSync`删除原始文件。
- 最后，使用`readStream.pipe(writeStream)`将读取到的数据流复制到目标文件流中。
- 函数返回一个`Promise`对象，在复制完成时调用`resolve`方法表示操作成功，或在出现错误时调用`reject`方法表示操作失败。

`mergeFileChunk`函数：该函数用于合并文件分片。函数接收三个参数：`filePath`表示合并后的文件路径，`fileHash`表示文件的哈希值，`size`表示每个分片的大小。

- 首先，根据文件哈希值构建切片文件夹的路径`chunkDir`。
- 使用`fse.readdir`异步地读取切片文件夹中的文件列表，并将结果赋值给`chunkPaths`变量。这里使用`await`关键字等待读取完成。
- 对`chunkPaths`数组进行排序，以确保按照切片的索引进行顺序合并。排序依据是文件名中切片索引的大小。
- 使用`Promise.all`方法并发执行一组操作，每个操作都是调用`pipeStream`函数来将分片文件的数据复制到合并文件中的指定位置。
- `pipeStream`函数的参数包括切片文件的路径和创建的写入流。
- 合并完成后，使用`fse.rmdirSync`删除保存切片的目录。
- 函数内部使用`await`关键字等待所有并发的合并操作完成。

## 进度条展示

```js
const [totalProgress, setTotalProgress] = useState < number > 0;

// 进度条处理
const createProgressHandler = useCallback(
  (index: number) => (e: any) => {
    setFileChunkList((prevList) => {
      const newList = [...prevList];
      newList[index] = {
        ...newList[index],
        percentage: parseInt(String((e.loaded / e.total) * 100)),
      };
      const totalPercentage =
        newList.reduce((total, chunk) => total + chunk.percentage, 0) /
        newList.length;
      setTotalProgress(totalPercentage);
      return newList;
    });
  },
  [fileChunkList, file]
);
```

`createProgressHandler`函数，它使用`useCallback`钩子创建一个回调函数。该回调函数接收一个参数`index`表示当前处理的分片索引，返回一个事件处理函数来处理上传进度。

1. `(e: any) => { ... }`: 事件处理函数，接收一个事件对象`e`作为参数，用于处理上传进度事件。
2. `setFileChunkList((prevList) => { ... });`: 使用`setFileChunkList`函数更新`fileChunkList`状态，将其值替换为更新后的列表。这里使用函数式的更新形式，接收一个回调函数作为参数，该回调函数接收前一个状态`prevList`并返回新的状态值。
3. `const newList = [...prevList];`: 创建一个新的列表`newList`，复制前一个状态`prevList`中的所有元素。
4. `newList[index] = { ...newList[index], percentage: parseInt(String((e.loaded / e.total) * 100)) };`: 在`newList`中更新指定索引`index`处的元素，将其`percentage`属性更新为上传进度的百分比。上传进度的计算公式是`(e.loaded / e.total) * 100`，通过`parseInt`函数将其转为整数。
5. `const totalPercentage = newList.reduce((total, chunk) => total + chunk.percentage, 0) / newList.length;`: 计算所有分片的平均上传进度。使用`reduce`方法对`newList`中的每个分片进行累加计算，将所有分片的进度相加并除以分片数量，得到平均进度。
6. `setTotalProgress(totalPercentage);`: 使用`setTotalProgress`函数更新`totalProgress`状态，将其值设为计算得到的平均进度。
7. `return newList;`: 返回更新后的分片列表`newList`，作为新的状态值。

待优化内容：

1. 减少状态更新频率：在当前的代码中，每次上传进度更新时都会调用`setFileChunkList`和`setTotalProgress`来更新状态。这可能会引发频繁的状态更新操作，从而导致性能问题。您可以考虑使用节流或防抖技术，限制状态更新的频率，例如通过设置一个定时器或基于时间间隔来控制状态更新的触发，从而减少不必要的更新。
2. 优化数据结构和更新逻辑：如果分片的数量非常大，那么数组的操作可能会变得低效。您可以尝试使用更高效的数据结构，如`Map`或`Object`，以提高性能和查找效率。此外，评估更新逻辑是否可以进行优化，例如仅在进度超过某个阈值或特定条件满足时才进行状态更新。
   1. 使用更精确的进度计算：当前的代码中使用简单的百分比计算来表示上传进度。但是，这可能无法提供准确的进度显示，特别是在网络传输存在延迟或不稳定的情况下。您可以考虑使用更精确的计算方法，如基于已上传字节数和文件总字节数的实际进度计算，以提供更准确的进度展示。
3. 添加进度平滑过渡效果：为了改善用户体验，您可以添加进度的平滑过渡效果，使进度条在更新时以柔和的方式进行过渡，而不是突然跳变。这可以通过动画效果或渐变过渡来实现，以增加用户对上传进度的感知。
4. 增加用户反馈和提示：除了显示进度条，还可以增加其他形式的用户反馈和提示，例如文本提示、图标或动画效果等。这些反馈和提示可以向用户提供更多的信息，例如上传已完成、上传失败或可能的错误提示，以增强用户体验和交互。

## 暂停/恢复上传

```jsx
const [source, setSource] = useState(http.CancelToken.source());

// 暂停/取消上传
const handlePause = () => {
  source.cancel();
  // 处理点击取消上传后，无法再次重新上传的问题
  setSource(http.CancelToken.source());
};

// 重新上传
const handleReupload = async () => {
  if (!file) return;
  await handleUpload(file, fileHash, fileChunkList, undefined);
};
```

`source`是一个`CancelToken`实例，用于取消上传请求。当调用`source.cancel()`取消上传请求时，该`CancelToken`实例将被标记为已取消状态。

然而，一旦`CancelToken`实例被取消，它将无法再次使用。这意味着如果尝试使用同一个`CancelToken`实例来发送新的上传请求，该请求将被认为是已取消的，并且不会被服务器处理。

为了解决这个问题，需要重新生成一个新的`CancelToken`实例，以便在取消上传后能够重新触发上传请求。通过调用`http.CancelToken.source()`可以生成一个新的`CancelToken`实例，并将其设置为新的`source`变量，以便在重新触发上传时使用。重新生成新的`CancelToken`实例是为了确保取消上传后，可以再次触发新的上传请求，而不会被认为是已取消的请求。

# others

## 待优化内容

1. 上传失败的场景处理
2. 切片数据未同储存在 indexDB 中，刷新页面后无法自动重新上传
3. 文件校验（如文件类型、大小限制等）
4. 上传成功后数据清除

## 遇到的问题

1. 在校验的需求上，前后端的校验是否有区别，什么该前端，什么该后端，什么样的场景下需要前后端一起。

### 1. 文件为什么可以被切片，切片的原理是什么

文件可以被切片是因为它们通常被存储为二进制，而二进制数据可以根据需要划分为一系列具有特定大小的块。在 Web 应用程序中，我们可以使用 JavaScript 中的 File API 对二进制数据进行操作并将其分成多个小块。

切片的原理是通过读取整个文件并将其拆分为块来实现。JavaScript 提供了一个 Blob 对象，可以通过设置 blob.slice(start, end) 将大型二进制 Blob 对象分成较小的块，以便在上传文件和其他操作时进行处理。

工作原理如下：

首先，将要切割的文件读入内存。

然后，使用 JavaScript 中的 Blob 构造函数将文件数据存储在一个 Blob 对象中。

接下来，将 Blob 对象使用 .slice() 方法划分为较小的块。参数 start 和 end 指定了起始和结束位置。

最后，使用 FileReader 读取每个块，并将其上传到服务器。

需要注意的是，当使用 Blob 和 FileReader 处理二进制数据时，由于其在内存中的占用空间，可能会导致性能问题。切分文件时需要注意合理设置块大小，以免影响应用程序的运行。

### 2. multiparty 中间件的使用

multiparty 是一个 Node.js 模块，用于处理 multipart/form-data 类型的 HTTP 请求，例如处理文件上传。

在 multiparty 中，fields 和 files 是两个对象，用于分别存储表单中普通字段和文件字段的数据。具体来说：

fields 对象包含表单中所有普通字段的数据，属性名称为字段名称，属性值为一个数组，包含该字段的所有值。例如，如果表单中有一个名为 "username" 的字段，那么 fields 对象中就会有一个属性名为 "username"，属性值为一个数组，包含该字段的所有值（可能有多个值）。

files 对象包含表单中所有文件字段的数据，属性名称为字段名称，属性值为一个数组，包含该字段上传的所有文件对象。每个文件对象包含文件名、文件类型、文件大小等信息。例如，如果表单中有一个名为 "avatar" 的文件上传字段，那么 files 对象中就会有一个属性名为 "avatar"，属性值为一个数组，包含上传到该字段的所有文件对象（可能有多个文件）。

multiparty 可以帮助开发者轻松地处理表单数据，并将数据解析为 fields 和 files 两个对象，方便开发者对这些数据进行处理和存储。

### 3. 为什么通过流进行文件合并(File stream)

文件流是一种数据流，用于在程序中以逐个字节或逐个块的方式处理文件内容或传输数据。文件流分为可读流和可写流，提供了一种非阻塞式、逐步读取或写入内容的方法，能够有效地处理大型或需要长时间处理的文件或数据。

可读流（Readable stream）是指从文件或数据源中逐个字节或逐个块地读取内容，并可以将读取到的内容传输到其他流中进行处理或保存。可读流允许我们通过监听事件来处理数据，例如 data 事件表示可读流已经读取到新的数据块，end 事件表示已经读取完所有数据，而 error 事件表示发生了错误。我们可以使用 pipe 方法连接多个可读流或可写流，实现对数据的分析或传输。

可写流（Writable stream）是指向文件或数据目标逐个字节或逐个块地写入内容，并可以接收其他流传输的数据，并将其写入目标中。可写流允许我们通过监听事件来处理数据，例如 drain 事件表示目标可以接受更多数据，finish 事件表示所有数据都已被写入，error 事件表示发生了错误。我们可以使用 pipe 方法连接多个可读流或可写流，实现对数据的传输或保存。

文件流的主要优点是可以在不占用大量内存的情况下高效地处理大型文件或数据。同时，流还提供了一种方便的方法来组合、分离和重用代码，使代码更加模块化、可读性更高，并易于维护。

https://www.digitalocean.com/community/tutorials/how-to-work-with-files-using-streams-in-node-js

### 4. 文件流长什么样

https://www.runoob.com/nodejs/nodejs-stream.html

文件流本身没有直接的外在形态，它是流式数据的概念。可以将它想象成一条流水线一样，通过管道连接两个流式数据的输入口和输出口。当数据通过这个流水线时，会以字节或块的形式被处理或传输。因此，我们无法直接观察到文件流的物理形态，但我们可以通过使用文件流 API 来创建和处理文件流，并通过读取和写入文件的操作来感知文件流的影响。

```js
// input.txt
// 菜鸟教程官网地址：www.runoob.com
// 管道流操作实例
var fs = require("fs");

// 创建一个可读流
var readerStream = fs.createReadStream('input.txt');

// 创建一个可写流
var writerStream = fs.createWriteStream('output.txt');

// 管道读写操作
// 读取 input.txt 文件内容，并将内容写入到 output.txt 文件中
readerStream.pipe(writerStream);

console.log("程序执行完毕");

// $ node main.js
// 程序执行完毕

// 查看 output.txt 文件的内容：
$ cat output.txt
// 菜鸟教程官网地址：www.runoob.com
// 管道流操作实例
readStream.on('end', () => {
  fse.unlinkSync(path);
  resolve();
});
```

在这段代码中，readStream 是一个可读流，通过调用 `fse.createReadStream(path)` 创建得到。`readStream` 实例会发出多个事件，包括：

`'data'`：当流有新的数据可供读取时触发。
`'end'`：当流没有更多数据可供读取时触发。
`'error'`：当在读取数据时发生错误时触发。
在这里，`readStream.on('end', ...)` 是用来监听 `'end'` 事件的。当这个事件被触发时，表示可读流已经读取完了指定的文件，不再有新的数据可供读取。在这个回调函数中，代码调用了`fse.unlinkSync(path)`方法来删除原始的文件，然后调用`resolve()`函数来表示整个 `Promise `已经成功完成了。

需要注意的是，当可读流出现错误时，会触发`'error'`事件，而不是`'end'`事件。因此，在处理可读流时，通常也需要监听`'error'`事件，以便及时处理可能出现的错误情况。

https://github.com/axios/axios/blob/main/examples/upload/index.html

### 5. 进度条没有能实时更新

```js
  // 创建文件上传请求
  const createRequestList = (
    fileChunkList: fileChunks[],
    uploadedLists: string[],
    createProgressHandler: (arg0: any) => any,
    cancelToken?: any
  ) => {
    return fileChunkList
      .filter(({ fileHash }) => !uploadedLists.includes(fileHash))
      .map(({ chunk, index, fileHash, hash }) => {
        let formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', fileHash);
        formData.append('filename', file!.name);
        return { formData, index };
      })
      .map(({ formData, index }) => {
        const config = {
        // 这里使用进度条函数
          onUploadProgress: createProgressHandler(index),
          cancelToken,
        };
        const request = http.post('/upload_single', formData, config);
        return request;
      });
  };
```

```js
// old
function createProgressHandler(index: number) {
  return (e: any) => {
    setFileChunkList((prevList) => {
      const newList = [...prevList];
      newList[index] = {
        ...newList[index],
        percentage: parseInt(String((e.loaded / e.total) * 100)),
      };
      return newList;
    });
  };
}
```

每次 render 组件时，都会重新生成 createProgressHandler 函数。这样会导致每个切片的 onUploadProgress 属性都变成了新的函数，而不是之前绑定过的函数，从而导致进度条更新的时候，会触发组件的重复渲染。

把 createProgressHandler 改为 useCallback，并把 fileChunkList 和 file 作为它的依赖项，这样就能够保证每个切片的 onUploadProgress 属性在组件 re-render 时，仍然是之前绑定过的函数。

```js
// new
const createProgressHandler = useCallback(
  (index: number) => (e: any) => {
    setFileChunkList((prevList) => {
      const newList = [...prevList];
      newList[index] = {
        ...newList[index],
        percentage: parseInt(String((e.loaded / e.total) * 100)),
      };
      return newList;
    });
  },
  [fileChunkList, file]
);
```

### 6. web-worker 是什么

使用 web-worker 在 worker 线程计算 hash，防止文件过大引起 ui 阻塞。

Web Worker 是一种 Web API，用于在 Web 应用程序中创建并执行多线程 JavaScript 代码。它允许开发人员在不阻塞主线程的情况下，使用单独的线程来执行一些耗时操作，如大量数据的处理、计算、排序、过滤、搜索等。

Web Worker 能够让 JavaScript 代码在不阻塞 UI 线程的情况下运行，因为它们在后台线程中执行。这可以帮助提高 Web 应用程序的性能和响应性。Web Worker 在一个独立的全局上下文中运行，这意味着它们不能访问主线程的变量或函数，而且它们必须通过 postMessage 方法来与主线程进行通信。

Web Worker 通常用于执行 CPU 密集型的任务，例如图像处理、视频编码、解码等。但需要注意的是，Web Worker 并不是在所有的 Web 浏览器中都可用。

## refs

1. https://juejin.cn/post/6844904046436843527#heading-16
2. https://medium.com/swlh/uploadig-large-files-as-chunks-using-reactjs-net-core-2e6e00e13875
3. https://juejin.cn/post/6993686386389827592
4. https://zhuanlan.zhihu.com/p/386493135
5. https://zhuanlan.zhihu.com/p/546661256
6. https://juejin.cn/post/6844904055819468808
