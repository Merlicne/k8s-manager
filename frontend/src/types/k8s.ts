export interface Pod {
  name: string;
  namespace: string;
  status: string;
  node?: string;
}
