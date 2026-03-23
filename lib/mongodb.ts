import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri && process.env.NODE_ENV === "development") {
  console.warn(
    "[mongodb] MONGODB_URI is not set. Saved leads APIs will return errors."
  );
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(
      new Error("MONGODB_URI is not configured")
    );
  }
  if (!clientPromise) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const c = await getMongoClient();
  return c.db(process.env.MONGODB_DB_NAME ?? "lead_scraper");
}
