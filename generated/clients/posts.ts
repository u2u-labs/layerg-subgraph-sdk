
import { request } from "graphql-request";
import type { Post } from "../types/Post";
import type { PostSelect } from "../types/PostSelect";
import { buildFieldSelection } from "../helpers";

const defaultFields = "id\n        title\n        content\n        user { id }";

function selectFields(select: PostSelect | undefined): string {
  return select
    ? buildFieldSelection([{"kind":"FieldDefinition","name":{"kind":"Name","value":"id","loc":{"start":74,"end":76}},"arguments":[],"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID","loc":{"start":78,"end":80}},"loc":{"start":78,"end":80}},"directives":[],"loc":{"start":74,"end":80}},{"kind":"FieldDefinition","name":{"kind":"Name","value":"title","loc":{"start":83,"end":88}},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String","loc":{"start":90,"end":96}},"loc":{"start":90,"end":96}},"loc":{"start":90,"end":97}},"directives":[],"loc":{"start":83,"end":97}},{"kind":"FieldDefinition","name":{"kind":"Name","value":"content","loc":{"start":100,"end":107}},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String","loc":{"start":109,"end":115}},"loc":{"start":109,"end":115}},"loc":{"start":109,"end":116}},"directives":[],"loc":{"start":100,"end":116}},{"kind":"FieldDefinition","name":{"kind":"Name","value":"user","loc":{"start":119,"end":123}},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"User","loc":{"start":125,"end":129}},"loc":{"start":125,"end":129}},"loc":{"start":125,"end":130}},"directives":[],"loc":{"start":119,"end":130}}], select)
    : defaultFields;
}

export function posts(subgraphUrl: string) {
  return {
    findById(id: string) {
      return {
        async select(select: PostSelect): Promise<Post | null> {
          const gqlFields = selectFields(select);

          const query = `
            query ($id: ID!) {
              posts(where: { id: $id }) {
                ${gqlFields}
              }
            }
          `;
          type Response = { posts: Post[] };
          const res: Response = await request(subgraphUrl, query, { id });
          return res.posts[0] || null;
        }
      };
    },

    findMany(args: { where?: Partial<Post>; first?: number; skip?: number; orderBy?: string; orderDirection?: string }) {
      return {
        async select(select: PostSelect): Promise<Post[]>  {
        const gqlFields = selectFields(select);     
        const { where } = args;

        const whereLiteral = Object.entries(where || {}).map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}: "${value}"`;
        }})

        const query = `query {
        posts(where: { ${whereLiteral} }) {
          ${gqlFields}
        }}`;
    
        type Response = { posts: Post[] };
        const res: Response = await request(subgraphUrl, query, { where });
        return res.posts;
      }          
    }},

    subscribe({ onData }: { onData: (data: Post) => void }): void {
      const sseUrl = `${subgraphUrl.replace("/graphql", "/events/stream")}&&typeName=posts`;
      const es = new EventSource(sseUrl);

      es.onmessage = (event) => {
        try {
          const data: Post = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      };

      es.onerror = (err) => {
        console.error("SSE connection error", err);
        es.close();
      };

      es.addEventListener("connection", (event) => {
        try {
          const data: Post = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("insert", (event) => {
        try {
          const data: Post = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("update", (event) => {
        try {
          const data: Post = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("delete", (event) => {
        try {
          const data: Post = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });
    }
  };
}