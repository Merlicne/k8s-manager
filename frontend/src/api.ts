import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  node?: string;
}

export const getContexts = async (): Promise<string[]> => {
  const response = await api.get('/contexts');
  return response.data.contexts;
};

export const getPods = async (context: string): Promise<Pod[]> => {
  const response = await api.get(`/${context}/pods`);
  return response.data.pods;
};
