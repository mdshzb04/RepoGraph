import { promises as fs } from "fs";
import path from "path";

export type StoredUser = {
  email: string;
  passwordHash: string;
  createdAt: string;
};

type UsersDatabase = {
  users: StoredUser[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function ensureStore(): Promise<UsersDatabase> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as UsersDatabase;
    if (!Array.isArray(parsed.users)) {
      return { users: [] };
    }
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function writeStore(db: UsersDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function findUserByEmail(
  email: string
): Promise<StoredUser | undefined> {
  const db = await ensureStore();
  return db.users.find((user) => user.email === email);
}

export async function createUser(
  email: string,
  passwordHash: string
): Promise<StoredUser> {
  const db = await ensureStore();
  if (db.users.some((user) => user.email === email)) {
    throw new Error("EMAIL_EXISTS");
  }

  const user: StoredUser = {
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  await writeStore(db);
  return user;
}
