import fs from 'fs';

const TEST_DATA_DIR = '/tmp/9router-test-data';

export default async function globalSetup() {
  // Ensure test data directory exists for the web server
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}
