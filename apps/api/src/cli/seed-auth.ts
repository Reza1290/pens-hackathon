import { db, pool } from '../db/client.js';
import { seedDefaultUsers } from '../modules/auth/service.js';

try {
  const result = await seedDefaultUsers(db);
  console.log(`Auth seed complete: ${result.created} created, ${result.existing} already existing.`);
} finally {
  await pool.end();
}
