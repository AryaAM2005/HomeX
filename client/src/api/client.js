import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// For links and images, which the browser loads without going through axios.
export const apiUrl = (path) => `${api.defaults.baseURL}${path}`;

export function getErrorMessage(err) {
  if (err.response?.status === 413) return 'Those files are too large. Please keep them under 4 MB in total.';
  if (err.response?.data?.error?.message) return err.response.data.error.message;
  return "We can't reach HomeX right now. Please check your connection and try again.";
}

export function getFieldErrors(err) {
  return err.response?.data?.error?.fields ?? {};
}
