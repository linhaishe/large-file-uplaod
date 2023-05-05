import React, { useState } from "react";
import { Button } from "antd";
import "./App.css";
import http from "./api/http";

function App() {
  const [file, setUploadFile] = useState<File | null>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 单个文件上传
    const file: File = (e.target.files as FileList)[0];
    if (!file) {
      alert("请上传文件");
    }
    setUploadFile(file);
  };

  const handleFileUpload = () => {
    if (!file) return;
    let formData = new FormData();
    formData.append("file", file);
    formData.append("filename", file.name);
    http
      .post("/upload_single", formData)
      .then((res) => {
        console.log(res.data.code);
        if (res.data.code === 0) {
          alert(
            `文件已经上传成功~,您可以基于${res.data.servicePath}访问这个资源~~^ `
          );
          return;
        }
        return Promise.reject(res.data.codeText);
      })
      .catch((reason) => {
        alert("文件上传失败，请您稍后再试~~");
      });
  };
  return (
    <div className="App">
      <header className="App-header">
        <input type={"file"} onChange={handleFileChange} />
        <Button type="primary" onClick={handleFileUpload}>
          Upload
        </Button>
      </header>
    </div>
  );
}

export default App;
