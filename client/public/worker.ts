/* eslint-disable no-restricted-globals */
importScripts('/client/public/spark-md5.min.js');

const workercode = () => {
  self.onmessage = (e) => {
    const { fileChunkList } = e.data;
    const spark = new self.SparkMD5.ArrayBuffer();
    let percentage = 0;
    let count = 0;
    const loadNext = (index: any) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(fileChunkList[index].file);
      reader.onload = (e) => {
        count++;
        spark.append(e?.target?.result);
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
};

export default workercode;
