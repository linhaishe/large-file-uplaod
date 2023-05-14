// readme

# large-file-uplaod

refs:

1. https://juejin.cn/post/6844904046436843527#heading-16
2. https://medium.com/swlh/uploadig-large-files-as-chunks-using-reactjs-net-core-2e6e00e13875
3. https://juejin.cn/post/6993686386389827592
4. https://zhuanlan.zhihu.com/p/386493135
5. https://zhuanlan.zhihu.com/p/546661256

qa:

1. https://bobbyhadz.com/blog/typescript-could-not-find-a-declaration-file-for-module
2. https://github.com/nodejs/help/issues/3728

```bash
#
# Fatal error in , line 0
# Fatal JavaScript invalid size error 169220804
#
#
#
#FailureMessage Object: 0x7ff7bdacfe10
 1: 0x102565ef2 node::NodePlatform::GetStackTracePrinter()::$_3::__invoke() [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
 2: 0x10353bf13 V8_Fatal(char const*, ...) [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
 3: 0x1027ea776 v8::internal::FactoryBase<v8::internal::Factory>::NewFixedArray(int, v8::internal::AllocationType) [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
 4: 0x102980564 v8::internal::(anonymous namespace)::ElementsAccessorBase<v8::internal::(anonymous namespace)::FastPackedObjectElementsAccessor, v8::internal::(anonymous namespace)::ElementsKindTraits<(v8::internal::ElementsKind)2> >::GrowCapacity(v8::internal::Handle<v8::internal::JSObject>, unsigned int) [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
 5: 0x102b9c07d v8::internal::Runtime_GrowArrayElements(int, unsigned long*, v8::internal::Isolate*) [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
 6: 0x102f539f9 Builtins_CEntry_Return1_DontSaveFPRegs_ArgvOnStack_NoBuiltinExit [/Users/lichunxian/.nvm/versions/node/v16.15.1/bin/node]
```

3. 文件为什么可以被切片，切片的原理是什么

文件可以被切片是因为它们通常被存储为二进制，而二进制数据可以根据需要划分为一系列具有特定大小的块。在 Web 应用程序中，我们可以使用 JavaScript 中的 File API 对二进制数据进行操作并将其分成多个小块。
切片的原理是通过读取整个文件并将其拆分为块来实现。JavaScript 提供了一个 Blob 对象，可以通过设置 blob.slice(start, end) 将大型二进制 Blob 对象分成较小的块，以便在上传文件和其他操作时进行处理。

工作原理如下：

首先，将要切割的文件读入内存。
然后，使用 JavaScript 中的 Blob 构造函数将文件数据存储在一个 Blob 对象中。
接下来，将 Blob 对象使用 .slice() 方法划分为较小的块。参数 start 和 end 指定了起始和结束位置。
最后，使用 FileReader 读取每个块，并将其上传到服务器。
需要注意的是，当使用 Blob 和 FileReader 处理二进制数据时，由于其在内存中的占用空间，可能会导致性能问题。切分文件时需要注意合理设置块大小，以免影响应用程序的运行。

3. 切片思路分析：

要将一个文件进行切片，需要借助文件的**==size==属性和==slice==**方法
方法一（固定个数）：将一个文件切成固定个数，比如 20 个，然后用 size/20 计算出每个切片文件的大小，再利用 slice 进行截取
方法二（固定大小）：固定每个切片文件的大小，比如 100k，然后用 size/100 计算需要分成几个切片，同样也是再用 slice 截取
在本案例中，我们将采取方法一和方法二合并的方式进行切片：我们先根据方法二固定每个切片的大小，计算出切片的个数，然后再规定一个最大个数，如果计算出的个数超过了最大个数，就需要根据方法一进行重新切片。如果没有超出个数，则按固定大小切片。

file 做切片上传，利用 sparkmd5 做辨别，那么 sparkmd5 是给整个 file 做 hash 还是每个分片做 hash

一般情况下，我们将使用 SparkMD5 对每个文件切片进行哈希计算。

在使用 File API 将大型文件上传到服务器时，我们通常需要将文件拆分成较小的块。然后，我们使用 SparkMD5 库对每个块执行哈希操作，并将结果与服务器中的哈希进行比较，以验证文件的完整性。

对于每个块，SparkMD5 库将使用 MD5 哈希函数对其进行单独计算，并生成唯一的哈希值。这个哈希值将被用作标识符来验证数据块是否已成功上传，以及检测任何数据丢失或错误。

最后，我们可以将所有块的哈希值合并为一个哈希值来验证整个文件的完整性。如果与服务器上存储的哈希匹配，则文件传输完成。

因此，SparkMD5 库将对每个文件块进行哈希计算，而不是对整个文件进行哈希计算。

将所有块的哈希值合并为一个哈希值来验证整个文件的完整性，这个是什么逻辑原理

将所有块的哈希值合并为一个哈希值来验证整个文件的完整性，是通过将每个块的哈希值连接起来，再对这个连接后的字符串计算哈希值的方式来实现的。

具体地说，假设我们有一个文件，其中包含 n 个数据块，每个数据块的哈希值为 H1, H2, ..., Hn。则我们可以将这些哈希值串联起来，形成一个新的字符串 S = H1 + H2 + ... + Hn。接着，我们再对字符串 S 计算一个新的哈希值 H，并将这个哈希值与服务器上存储的哈希值进行比较。如果这两个哈希值相等，则说明文件传输完成且文件完整。

该逻辑原理的核心在于哈希函数的不可逆性和单向性。哈希函数是一种将任意长度的输入（如文件、数据块）转换成固定长度的输出的函数，其输出值是不可逆的，也就是说，无法从哈希值还原出原始数据。同时，哈希函数应当满足单向性，即对于任何给定的输出，都很难找到一个使其输出等于该值的输入。因此，在将所有块的哈希值连接起来合并为一个哈希值后，这个新的哈希值将成为一个唯一标识整个文件完整性的值。

multiparty 是一个 Node.js 模块，用于处理 multipart/form-data 类型的 HTTP 请求，例如处理文件上传。

在 multiparty 中，fields 和 files 是两个对象，用于分别存储表单中普通字段和文件字段的数据。具体来说：

fields 对象包含表单中所有普通字段的数据，属性名称为字段名称，属性值为一个数组，包含该字段的所有值。例如，如果表单中有一个名为 "username" 的字段，那么 fields 对象中就会有一个属性名为 "username"，属性值为一个数组，包含该字段的所有值（可能有多个值）。
files 对象包含表单中所有文件字段的数据，属性名称为字段名称，属性值为一个数组，包含该字段上传的所有文件对象。每个文件对象包含文件名、文件类型、文件大小等信息。例如，如果表单中有一个名为 "avatar" 的文件上传字段，那么 files 对象中就会有一个属性名为 "avatar"，属性值为一个数组，包含上传到该字段的所有文件对象（可能有多个文件）。
multiparty 可以帮助开发者轻松地处理表单数据，并将数据解析为 fields 和 files 两个对象，方便开发者对这些数据进行处理和存储。

为什么通过流进行文件合并(File stream)

文件流是一种数据流，用于在程序中以逐个字节或逐个块的方式处理文件内容或传输数据。文件流分为可读流和可写流，提供了一种非阻塞式、逐步读取或写入内容的方法，能够有效地处理大型或需要长时间处理的文件或数据。

可读流（Readable stream）是指从文件或数据源中逐个字节或逐个块地读取内容，并可以将读取到的内容传输到其他流中进行处理或保存。可读流允许我们通过监听事件来处理数据，例如 data 事件表示可读流已经读取到新的数据块，end 事件表示已经读取完所有数据，而 error 事件表示发生了错误。我们可以使用 pipe 方法连接多个可读流或可写流，实现对数据的分析或传输。

可写流（Writable stream）是指向文件或数据目标逐个字节或逐个块地写入内容，并可以接收其他流传输的数据，并将其写入目标中。可写流允许我们通过监听事件来处理数据，例如 drain 事件表示目标可以接受更多数据，finish 事件表示所有数据都已被写入，error 事件表示发生了错误。我们可以使用 pipe 方法连接多个可读流或可写流，实现对数据的传输或保存。

文件流的主要优点是可以在不占用大量内存的情况下高效地处理大型文件或数据。同时，流还提供了一种方便的方法来组合、分离和重用代码，使代码更加模块化、可读性更高，并易于维护。

https://www.digitalocean.com/community/tutorials/how-to-work-with-files-using-streams-in-node-js

文件流长什么样

https://www.runoob.com/nodejs/nodejs-stream.html

文件流本身没有直接的外在形态，它是流式数据的概念。可以将它想象成一条流水线一样，通过管道连接两个流式数据的输入口和输出口。当数据通过这个流水线时，会以字节或块的形式被处理或传输。因此，我们无法直接观察到文件流的物理形态，但我们可以通过使用文件流 API 来创建和处理文件流，并通过读取和写入文件的操作来感知文件流的影响。

```
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
菜鸟教程官网地址：www.runoob.com
管道流操作实例
```

```js
readStream.on('end', () => {
  fse.unlinkSync(path);
  resolve();
});
这个end是什么意思;
```

```
在这段代码中，readStream 是一个可读流，通过调用 fse.createReadStream(path) 创建得到。readStream 实例会发出多个事件，包括：

'data'：当流有新的数据可供读取时触发。
'end'：当流没有更多数据可供读取时触发。
'error'：当在读取数据时发生错误时触发。
在这里，readStream.on('end', ...) 是用来监听 'end' 事件的。当这个事件被触发时，表示可读流已经读取完了指定的文件，不再有新的数据可供读取。在这个回调函数中，代码调用了 fse.unlinkSync(path) 方法来删除原始的文件，然后调用 resolve() 函数来表示整个 Promise 已经成功完成了。

需要注意的是，当可读流出现错误时，会触发 'error' 事件，而不是 'end' 事件。因此，在处理可读流时，通常也需要监听 'error' 事件，以便及时处理可能出现的错误情况。
```

https://github.com/axios/axios/blob/main/examples/upload/index.html

进度条没有能实时更新

可以优化的地方在于，每次 render 组件时，都会重新生成 createProgressHandler 函数。这样会导致每个切片的 onUploadProgress 属性都变成了新的函数，而不是之前绑定过的函数，从而导致进度条更新的时候，会触发组件的重复渲染。

为了解决这个问题，可以把 createProgressHandler 改为 useCallback，并把 fileChunkList 和 file 作为它的依赖项，这样就能够保证每个切片的 onUploadProgress 属性在组件 re-render 时，仍然是之前绑定过的函数。

```js
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

可以优化的地方在于，每次 render 组件时，都会重新生成 createProgressHandler 函数。这样会导致每个切片的 onUploadProgress 属性都变成了新的函数，而不是之前绑定过的函数，从而导致进度条更新的时候，会触发组件的重复渲染。

为了解决这个问题，可以把 createProgressHandler 改为 useCallback，并把 fileChunkList 和 file 作为它的依赖项，这样就能够保证每个切片的 onUploadProgress 属性在组件 re-render 时，仍然是之前绑定过的函数。

```js
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

重复请求/upload_single

useEffect 中发起了上传请求，并且每次 fileChunkList 变化都会触发 useEffect，导致重复请求。为了避免重复请求，可以对上传状态进行维护，在上传完成后再进行下一步操作。具体实现可以考虑引入一个上传状态（如 isUploading），在上传过程中将其设置为 true，在上传完成后再将其设置为 false，只有在 isUploading 为 false 时才能触发上传。

使用 web-worker 在 worker 线程计算 hash，防止文件过大引起 ui 阻塞。

Web Worker 是一种 Web API，用于在 Web 应用程序中创建并执行多线程 JavaScript 代码。它允许开发人员在不阻塞主线程的情况下，使用单独的线程来执行一些耗时操作，如大量数据的处理、计算、排序、过滤、搜索等。

Web Worker 能够让 JavaScript 代码在不阻塞 UI 线程的情况下运行，因为它们在后台线程中执行。这可以帮助提高 Web 应用程序的性能和响应性。Web Worker 在一个独立的全局上下文中运行，这意味着它们不能访问主线程的变量或函数，而且它们必须通过 postMessage 方法来与主线程进行通信。

Web Worker 通常用于执行 CPU 密集型的任务，例如图像处理、视频编码、解码等。但需要注意的是，Web Worker 并不是在所有的 Web 浏览器中都可用。

Refused to execute script from 'http://localhost:3000/worker.ts' because its MIME type ('video/mp2t') is not executable.

```js
const createFileChunksWithHash = (file: File, size = SIZE) => {
  return new Promise((resolve) => {
    const fileChunks: fileChunks[] = [];
    const worker = new Worker('hash-worker.js');
    for (let cur = 0, index = 0; cur < file.size; index++) {
      const fileChunk = file.slice(cur, cur + size);
      fileChunks.push({ chunk: fileChunk, index, percentage: 0 });
      cur += size;
    }

    worker.postMessage({ fileChunks });

    worker.onmessage = (e) => {
      const { percentage, hash } = e.data;
      if (hash) {
        for (const chunk of fileChunks) {
          if (chunk.hash === hash) {
            chunk.filehash = hash;
          }
        }
        resolve(fileChunks);
      } else {
        setHashPercentage(percentage);
      }
    };
  });
};
```

```js
http.interceptors.request.use(
  (config) => {
    const source = axios.CancelToken.source();
    http.cancelTokenSources.push(source);
    config.cancelToken = source.token;
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => {
    http.cancelTokenSources = http.cancelTokenSources.filter(
      (source) => source.token !== response.config.cancelToken
    );
    return response;
  },
  (error) => {
    http.cancelTokenSources = http.cancelTokenSources.filter(
      (source) => source.token !== error.config.cancelToken
    );
    return Promise.reject(error);
  }
);
```

```js
const [cancelTokenSource, setCancelTokenSource] = useState(
  http.CancelToken.source()
);
const tokenRef = React.useRef(http.CancelToken.source());
```

第一种方法中，cancelTokenSource 是一个使用 useState 创建的状态变量。useState 返回一个包含两个元素的数组：状态值和一个用于更新状态的函数。初始状态值是一个 CancelToken.source() 的实例。

而在第二种方法中，tokenRef 是一个 useRef 对象，它持有调用 http.CancelToken.source() 的结果。

两种方法的主要区别在于，当 cancelTokenSource 的状态值发生变化时，组件会重新渲染，从而创建一个新的 CancelToken.source() 实例。而使用 useRef 创建的 tokenRef 则始终持有同一个 http.CancelToken.source() 实例的引用。

如果你需要在组件渲染期间保持 http.CancelToken.source() 实例的引用不变，那么使用 useRef 可能更适合你的需求。

当使用 useState 创建状态变量时，每次组件重新渲染时都会重新创建新的 CancelToken.source() 实例，并将其作为状态值存储。这可能会导致不必要的实例创建和资源浪费。

而使用 useRef 创建的 tokenRef 对象可以在组件的整个生命周期内保持不变。这样，在你需要使用 CancelToken 时，你可以通过引用 tokenRef.current 获取到同一个 CancelToken.source() 实例，而无需创建新的实例。

总之，如果你希望在组件渲染期间保持某些变量的引用不变，那么使用 useRef 通常是更好的选择。

在 axios 中，cancelTokenSources 属性是一个数组，用于存储所有的 CancelTokenSource 对象，方便用户在需要取消请求的时候，可以通过 CancelToken 对象与 CancelTokenSource 对象协同工作来取消请求。CancelTokenSource 是一个工厂函数，用于创建一个包含 CancelToken 和 cancel 方法的对象，CancelToken 对象用于生成一个 token，在需要取消请求时传入请求的 config 中，cancel 方法用于触发取消请求的操作。

以下是 cancelTokenSources 的使用方法：

导入 axios 和 CancelToken：
javascript

```js
import axios, { CancelToken } from 'axios';
创建CancelTokenSource对象：
javascript
Copy code
const cancelTokenSource = CancelToken.source();
在请求的config中添加cancelToken属性：
javascript
Copy code
axios.get('/api/data', {
  cancelToken: cancelTokenSource.token
}).then(response => {
  console.log(response.data);
}).catch(error => {
  if (axios.isCancel(error)) {
    console.log('Request canceled:', error.message);
  } else {
    console.log(error);
  }
});
```

在需要取消请求的时候，调用 cancel 方法：
javascript
Copy code
cancelTokenSource.cancel('请求已取消'); // 可以带一个取消的信息作为参数
注意：一旦调用了 cancel 方法，会使得与该 CancelToken 相关联的所有请求都会被取消，并且会抛出一个 Cancel 异常，可以通过 axios.isCancel 方法来判断是否是 Cancel 异常。另外，每次请求需要重新创建一个 CancelTokenSource 对象，因为 CancelToken 是一次性的，不能重复使用。

```
// create cancel token source for each request
  const cancelTokenSrc = axios.CancelToken.source();
  cancelTokenRef.current[index] = {
    cancelToken: cancelTokenSrc.token,
    source: cancelTokenSrc,
  };
```

```js
http.requestList = [];
http.cancelList = [];

http.interceptors.request.use(
  (config) => {
    console.log('config', config);
    return config;
  },
  (error) => Promise.reject(error)
);

http.interceptors.response.use(
  (response) => {
    console.log('response', response);

    // remove completed requests from cancelList
    const cancelIndex = http.cancelList.findIndex(
      (item) => item.token === response.config.cancelToken
    );
    if (cancelIndex > -1) {
      http.cancelList.splice(cancelIndex, 1);
    }
    return response;
  },
  (error) => {
    // remove cancelled requests from cancelList
    const cancelIndex = http.cancelList.findIndex(
      (item) => item.token === error.config.cancelToken
    );
    if (cancelIndex > -1) {
      http.cancelList.splice(cancelIndex, 1);
    }
    return Promise.reject(error);
  }
);
```

// 文件上传完后，用户触发暂停，但是文件却已经上传完成，如果用户再点击上传，则直接进行合并
