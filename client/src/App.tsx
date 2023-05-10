// app.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Progress } from 'antd';
import './App.css';
import http from './api/http';

interface fileChunks {
  chunk: Blob;
  hash: string;
  index: number;
  percentage: number;
}

// 切片大小 10MB
const SIZE = 10 * 1024 * 1024;

// 生成文件切片
function createFileChunksWithHash(file: File, size = SIZE) {
  const fileChunks = [];
  for (let cur = 0, index = 0; cur < file.size; index++) {
    const fileChunk = file.slice(cur, cur + size);
    const hash = `${file.name}-${cur / size}`;
    fileChunks.push({ chunk: fileChunk, hash, index, percentage: 0 });
    cur += size;
  }
  return fileChunks;
}

function App() {
  const [file, setUploadFile] = useState<File | null>(null);
  const [fileChunkList, setFileChunkList] = useState<fileChunks[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [totalProgress, setTotalProgress] = useState<number>(0);

  const mergeRequest = async () => {
    const rsp = await http.post(
      '/merge',
      JSON.stringify({
        size: SIZE,
        filename: file?.name,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return rsp;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 单个文件上传
    const file: File = (e.target.files as FileList)[0];
    if (!file) {
      alert('请上传文件');
    }
    setUploadFile(file);
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
      if (!fileChunkList.length || !file || isUploading) {
        return;
      }

      setIsUploading(true);
      const requestList = fileChunkList
        .map(({ chunk, hash, index }) => {
          let formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('hash', hash);
          formData.append('filename', file.name);
          return { formData, index };
        })
        .map(({ formData, index }) =>
          http.post('/upload_single', formData, {
            onUploadProgress: createProgressHandler(index),
          })
        );
      console.log('fileChunkListfileChunkList', fileChunkList);

      await Promise.all(requestList);
      const {
        data: { code, message },
      } = await mergeRequest();

      if (code === 0) {
        alert(message);
      }
    })();
  }, [fileChunkList]);

  const handleFileUpload = async () => {
    if (!file) return;
    const list = createFileChunksWithHash(file);
    setFileChunkList(list);
  };
  return (
    <div className='App'>
      <header className='App-header'>
        <input type='file' onChange={handleFileChange} />
        <Button type='primary' onClick={handleFileUpload}>
          Upload
        </Button>
        <Progress percent={totalProgress} />
        {fileChunkList.map((item, index) => {
          return (
            <div className='fileChunkList' key={index}>
              <div>{item.hash}</div>
              <Progress percent={item.percentage} />
            </div>
          );
        })}
      </header>
    </div>
  );
}

export default App;
