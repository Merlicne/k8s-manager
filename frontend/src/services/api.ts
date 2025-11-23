import axios from 'axios';
import type { Pod, K8sResourceType, GraphData } from '../types/k8s';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

export const getContexts = async (): Promise<string[]> => {
  const response = await api.get('/contexts');
  return response.data.contexts;
};

export const getResources = async (context: string, resourceType: K8sResourceType): Promise<any[]> => {
  const response = await api.get(`/${context}/resources/${resourceType}`);
  return response.data;
};

export const getResource = async (context: string, resourceType: K8sResourceType, name: string, namespace?: string): Promise<any> => {
  const params = namespace ? { namespace } : {};
  const response = await api.get(`/${context}/resources/${resourceType}/${name}`, { params });
  return response.data;
};

export const getResourceGraph = async (context: string, resourceType: K8sResourceType, name: string, namespace?: string): Promise<GraphData> => {
  const params = namespace ? { namespace } : {};
  const response = await api.get(`/${context}/resources/${resourceType}/${name}/graph`, { params });
  return response.data;
};
