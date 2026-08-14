const { assertPerformanceDatabase, connectedDatabaseIdentity } = require('../lib');
async function assertConnectedC4bPerformanceDatabase(client, env = process.env) {
  assertPerformanceDatabase(env); const identity = await connectedDatabaseIdentity(client);
  if (identity?.databaseName === 'topic_similarity_v1_dev') throw new Error('Refusing C4B operation: connected database is the development database.');
  if (identity?.databaseName !== 'topic_similarity_c4_perf') throw new Error('Refusing C4B operation: connected database is not the dedicated C4 performance database.');
  return { databaseName: identity.databaseName, serverAddress: identity.serverAddress || null, serverPort: identity.serverPort || null };
}
module.exports = { assertConnectedC4bPerformanceDatabase };
