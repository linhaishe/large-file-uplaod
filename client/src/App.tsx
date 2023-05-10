// app.tsx
import React, { useState } from 'react';
import { Button } from 'antd';
import './App.css';
import http from './api/http';

// 切片大小 10MB
const SIZE = 10 * 1024 * 1024;

// 生成文件切片
function createFileChunksWithHash(file: File, size = SIZE) {
  const fileChunks = [];
  for (let cur = 0; cur < file.size; ) {
    const fileChunk = file.slice(cur, cur + size);
    const hash = `${file.name}-${cur / size}`;
    fileChunks.push({ chunk: fileChunk, hash: hash });
    cur += size;
  }
  return fileChunks;
}

function App() {
  const [file, setUploadFile] = useState<File | null>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 单个文件上传
    const file: File = (e.target.files as FileList)[0];
    if (!file) {
      alert('请上传文件');
    }
    setUploadFile(file);
  };
  // testdvfevev
  const handleFileUpload = async () => {
    if (!file) return;
    const fileChunckList = createFileChunksWithHash(file);
    const mergeRequest = async () => {
      const rsp = await http.post(
        '/merge',
        JSON.stringify({
          size: SIZE,
          filename: file.name,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return rsp;
    };
    const requestList = fileChunckList
      .map(({ chunk, hash }) => {
        let formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('hash', hash);
        formData.append('filename', file.name);
        return { formData };
      })
      .map(({ formData }) => http.post('/upload_single', formData));

    await Promise.all(requestList);
    const {
      data: { code, message },
    } = await mergeRequest();

    if (code === 0) {
      alert(message);
    }
  };
  return (
    <div className='App'>
      <header className='App-header'>
        <input type={'file'} onChange={handleFileChange} />
        <Button type='primary' onClick={handleFileUpload}>
          Upload
        </Button>
      </header>
    </div>
  );
}

export default App;
