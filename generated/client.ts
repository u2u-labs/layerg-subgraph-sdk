
import { users } from "./clients/users";
import { posts } from "./clients/posts";

export function createSubgraphClient(subgraphUrl: string) {
  return {
    users: users(subgraphUrl),
    posts: posts(subgraphUrl),
  };
}