// http.ts

import axios from 'axios';
import qs from 'qs';

let http = axios.create();
http.defaults.baseURL = 'http://localhost:8888';
http.defaults.headers['Content-Type'] = 'multipart/form-data';
http.defaults.transformRequest = (data, headers) => {
  const contentType = headers['Content-Type'];
  if (contentType === 'application/x-www-form-urlencoded') {
    return qs.stringify(data);
  }
  return data;
};

export default http;
