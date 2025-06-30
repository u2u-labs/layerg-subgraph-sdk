export type PostSelect = {
  id?: boolean;
  title?: boolean;
  content?: boolean;
  user?: {
    id?: boolean;
    username?: boolean;
    name?: boolean;
  };
};