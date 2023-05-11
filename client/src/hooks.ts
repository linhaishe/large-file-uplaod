import { useState, useEffect } from 'react';

const useFileHash = (fileChunkList: any) => {
  const [hash, setHash] = useState('');
  const [hashPercentage, setHashPercentage] = useState(0);
  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    const createWorker = () => {
      const newWorker = new Worker('/client/public/worker.ts');
      newWorker.postMessage({ fileChunkList });

      newWorker.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercentage(percentage);
        if (hash) {
          setHash(hash);
        }
      };

      setWorker(newWorker);
    };

    createWorker();

    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [fileChunkList, worker]);

  return [hash, hashPercentage];
};

export default useFileHash;
