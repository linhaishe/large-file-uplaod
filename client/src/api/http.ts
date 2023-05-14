// http.ts

import axios, { AxiosStatic, AxiosInstance, CancelTokenSource } from 'axios';
import qs from 'qs';

interface HttpRequest {
  request: Promise<any>;
  cancelled: boolean;
}
interface Http extends AxiosStatic, AxiosInstance {
  cancelTokenSources: CancelTokenSource[];
  requestList: Promise<any>[];
  cancelList: CancelTokenSource[];
}

let http: Http = axios as Http;
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
