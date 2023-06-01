import React, { useCallback, useRef, useState } from 'react';
import { Button, Progress } from 'antd';
import './App.css';
import http from './api/http';

interface fileChunks {
  chunk: Blob;
  hash: string;
  index: number;
  percentage: number;
  fileHash: string;
}

interface UploadVerification {
  shouldUpload: boolean;
  uploadedList: string[];
  message: string;
}

// 切片大小 5MB
const SIZE = 5 * 1024 * 1024;

// 生成文件切片
function createFileChunksWithHash(file: File, size = SIZE) {
  const fileChunks: fileChunks[] = [];
  for (let cur = 0, index = 0; cur < file.size; index++) {
    const fileChunk = file.slice(cur, cur + size);
    const hash = `${file.name}-${cur / size}`;
    fileChunks.push({
      chunk: fileChunk,
      hash,
      index,
      percentage: 0,
      fileHash: '',
    });
    cur += size;
  }
  return fileChunks;
}

function App() {
  const [file, setUploadFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState('');
  const [fileChunkList, setFileChunkList] = useState<fileChunks[]>([]);
  const [rspUploadedLists, setRspUploadedList] = useState<string[]>([]); // 记录服务端已上传完成功的切片
  const [totalProgress, setTotalProgress] = useState<number>(0);
  const [source, setSource] = useState(http.CancelToken.source());
  const workerRef = useRef(new Worker('worker.js'));
  const worker = workerRef.current;

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
          onUploadProgress: createProgressHandler(index),
          cancelToken,
        };
        const request = http.post('/upload_single', formData, config);
        return request;
      });
  };

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

  // 分片上传后，触发合并请求
  const mergeRequest = async (allChunkFilesHash: string) => {
    const rsp = await http.post(
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

    return rsp;
  };

  // 确认文件是否已上传过, 实现秒传
  const isUploaded = async (
    fileName: string,
    fileHash: string
  ): Promise<UploadVerification> => {
    const { data } = await http.post(
      '/verify_upload',
      JSON.stringify({
        fileName,
        fileHash,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return data;
  };

  // 用户选择上传文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 单个文件上传
    const file: File = (e.target.files as FileList)[0];
    if (!file) {
      alert('请上传文件');
    }
    setUploadFile(file);
  };

  // 暂停/取消上传
  const handlePause = () => {
    source.cancel();
    // 处理点击取消上传后，无法再次重新上传的问题
    setSource(http.CancelToken.source());
  };

  // 文件上传/重新上传 重复函数抽离
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

  // 重新上传
  const handleReupload = async () => {
    if (!file) return;
    await handleUpload(file, fileHash, fileChunkList, undefined);
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

  return (
    <div className='App'>
      <header className='App-header'>
        <div className='uploadContainer'>
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
          {/* 总进度条 */}
          <Progress percent={totalProgress} className='totalPrograss' />
          {/* 分片进度条 */}
          {fileChunkList.map((item, index) => {
            return (
              <div className='fileChunkListPrograss' key={index}>
                <div>{item.fileHash}</div>
                <Progress percent={item.percentage} className='filePrograss' />
              </div>
            );
          })}
        </div>
      </header>
    </div>
  );
}

export default App;
