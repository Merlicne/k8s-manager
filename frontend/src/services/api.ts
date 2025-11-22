import axios from 'axios';
import type { Pod } from '../types/k8s';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

export const getContexts = async (): Promise<string[]> => {
  const response = await api.get('/contexts');
  return response.data.contexts;
};

export const getPods = async (context: string): Promise<Pod[]> => {
  const response = await api.get(`/${context}/pods`);
  return response.data.pods;
};
