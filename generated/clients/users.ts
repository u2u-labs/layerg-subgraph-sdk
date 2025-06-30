
import { request } from "graphql-request";
import type { User } from "../types/User";
import type { UserSelect } from "../types/UserSelect";
import { buildFieldSelection } from "../helpers";

const defaultFields = "id\n        username\n        name";

function selectFields(select: UserSelect | undefined): string {
  return select
    ? buildFieldSelection([{"kind":"FieldDefinition","name":{"kind":"Name","value":"id","loc":{"start":14,"end":16}},"arguments":[],"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID","loc":{"start":18,"end":20}},"loc":{"start":18,"end":20}},"directives":[],"loc":{"start":14,"end":20}},{"kind":"FieldDefinition","name":{"kind":"Name","value":"username","loc":{"start":23,"end":31}},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String","loc":{"start":33,"end":39}},"loc":{"start":33,"end":39}},"loc":{"start":33,"end":40}},"directives":[],"loc":{"start":23,"end":40}},{"kind":"FieldDefinition","name":{"kind":"Name","value":"name","loc":{"start":43,"end":47}},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String","loc":{"start":49,"end":55}},"loc":{"start":49,"end":55}},"loc":{"start":49,"end":56}},"directives":[],"loc":{"start":43,"end":56}}], select)
    : defaultFields;
}

export function users(subgraphUrl: string) {
  return {
    findById(id: string) {
      return {
        async select(select: UserSelect): Promise<User | null> {
          const gqlFields = selectFields(select);

          const query = `
            query ($id: ID!) {
              users(where: { id: $id }) {
                ${gqlFields}
              }
            }
          `;
          type Response = { users: User[] };
          const res: Response = await request(subgraphUrl, query, { id });
          return res.users[0] || null;
        }
      };
    },

    findMany(args: { where?: Partial<User>; first?: number; skip?: number; orderBy?: string; orderDirection?: string }) {
      return {
        async select(select: UserSelect): Promise<User[]>  {
        const gqlFields = selectFields(select);     
        const { where } = args;

        const whereLiteral = Object.entries(where || {}).map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}: "${value}"`;
        }})

        const query = `query {
        users(where: { ${whereLiteral} }) {
          ${gqlFields}
        }}`;
    
        type Response = { users: User[] };
        const res: Response = await request(subgraphUrl, query, { where });
        return res.users;
      }          
    }},

    subscribe({ onData }: { onData: (data: User) => void }): void {
      const sseUrl = `${subgraphUrl.replace("/graphql", "/events/stream")}&&typeName=users`;
      const es = new EventSource(sseUrl);

      es.onmessage = (event) => {
        try {
          const data: User = JSON.parse(event.data);
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
          const data: User = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("insert", (event) => {
        try {
          const data: User = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("update", (event) => {
        try {
          const data: User = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });

      es.addEventListener("delete", (event) => {
        try {
          const data: User = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error("Invalid SSE data", err);
        }
      });
    }
  };
}