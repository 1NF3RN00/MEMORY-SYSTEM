import { ApifyClient } from "apify-client";

export function createApifyClient(token: string): ApifyClient {
  return new ApifyClient({ token });
}
