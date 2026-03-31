import axios from "axios";

export const API_BASE_URL = "https://costing-product-bk.azurewebsites.net/api/v1" ;

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;
