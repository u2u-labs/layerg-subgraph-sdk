type HandlerConfig = {
  event: string;
  handler: string;
};

type SubgraphConfig = {
  dataSource: {
    chainId: number;
    contractAddress: string;
    startBlock: number;
  };
  schemaFilePath: string;
  name: string;
  handlers: HandlerConfig[];
};
