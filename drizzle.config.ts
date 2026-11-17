import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Never commit database credentials. Set DATABASE_URL in the environment when running
// Drizzle Kit locally or in a trusted deployment environment.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle Kit commands.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
