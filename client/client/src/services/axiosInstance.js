// src/services/axiosInstance.js
import axios from "axios";

const BASE_URL = "https://gymstack-zobot.onrender.com";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // ⬅️ IMPORTANT
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
