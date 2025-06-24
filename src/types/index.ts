export type SubgraphConfig = {
  name: string;
  slug: string;
  apiKey: string;
  region: string;
  resource: {
    schema: string;
    handler: string;
  };
  dataSources: Array<{
    chainId: number;
    contractAddress: string;
    startBlock: number;
  }>;
  eventHandlers: Array<{
    event: string;
    handler: string;
  }>;
};
