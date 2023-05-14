// app.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// 切片大小 10MB
const SIZE = 10 * 1024 * 1024;

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
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [totalProgress, setTotalProgress] = useState<number>(0);
  const [hashPercentage, setHashPercentage] = useState(0);
  const cancelTokenRef = useRef(http.CancelToken.source());
  const workerRef = useRef(new Worker('worker.js'));
  const worker = workerRef.current;
  // 计算所有切片的hash
  const calculateHash = (fileChunkList: any) => {
    return new Promise((resolve) => {
      worker.postMessage({ fileChunkList });

      worker.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercentage(percentage);
        if (hash) {
          resolve(hash);
        }
      };
    });
  };

  const mergeRequest = async () => {
    const rsp = await http.post(
      '/merge',
      JSON.stringify({
        size: SIZE,
        filename: file?.name,
        fileHash,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return rsp;
  };

  const isUploaded = async (fileName: string, fileHash: string) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 单个文件上传
    const file: File = (e.target.files as FileList)[0];
    if (!file) {
      alert('请上传文件');
    }
    setUploadFile(file);
  };

  const handlePause = () => {
    cancelTokenRef.current.cancel();
  };

  const handleFileUpload = async () => {
    if (!file) return;
    const list = createFileChunksWithHash(file);
    const allChunkFilesHash = await calculateHash(list);
    setFileHash(allChunkFilesHash as string);
    // 确认是否已经上传
    const { shouldUpload } = await isUploaded(
      file.name,
      allChunkFilesHash as string
    );
    if (!shouldUpload) {
      alert('上传成功');
      return;
    }
    list.map(
      (x, idx) => (x.fileHash = `${allChunkFilesHash as string}-${idx}`)
    );
    setFileChunkList(list);
  };

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

  useEffect(() => {
    (async () => {
      try {
        if (!fileChunkList.length || !file || isUploading) {
          return;
        }

        setIsUploading(true);
        const requestList = fileChunkList
          .map(({ chunk, index, fileHash, hash }) => {
            let formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('hash', fileHash);
            formData.append('filename', file.name);
            return { formData, index };
          })
          .map(({ formData, index }) => {
            const config = {
              onUploadProgress: createProgressHandler(index),
              cancelToken: cancelTokenRef.current.token,
            };
            const request = http.post('/upload_single', formData, config);
            return request;
          });

        await Promise.all(requestList);
        const {
          data: { code, message },
        } = await mergeRequest();

        if (code === 0) {
          alert(message);
        }
      } catch (error) {
        if (http.isCancel(error)) {
          console.log('请求被取消：', error);
        } else {
          console.error('上传文件出错：', error);
        }
      }
    })();
  }, [fileChunkList]);

  return (
    <div className='App'>
      <header className='App-header'>
        <input type='file' onChange={handleFileChange} />
        <Button type='primary' onClick={handleFileUpload}>
          上传
        </Button>
        <Button type='primary' onClick={handlePause}>
          暂停
        </Button>
        <Progress percent={totalProgress} />
        {fileChunkList.map((item, index) => {
          return (
            <div className='fileChunkList' key={index}>
              <div>{item.fileHash}</div>
              <Progress percent={item.percentage} />
            </div>
          );
        })}
      </header>
    </div>
  );
}

export default App;
