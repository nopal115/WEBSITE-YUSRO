# Backend test setup

The integration suite refuses to connect unless `TEST_DATABASE_URL` points to a
loopback PostgreSQL database whose name contains a `test` marker. It never reads
`DATABASE_URL`. Without `TEST_DATABASE_URL`, Jest skips the integration suite.

1. Copy `.env.test.example` to `.env.test`.
2. Start the isolated, ephemeral database with `npm run test:db:up`.
3. Apply migrations with `npm run test:db:migrate`.
4. Create the test accounts with `npm run test:seed`.
5. Run unit tests with `npm run test:unit`; run DB integration tests with
   `npm run test:integration`.
6. Stop and remove the test database with `npm run test:db:down`.

The database uses its own port (5433) and a temporary filesystem. Stopping the
container discards its data. Test seed accounts and passwords in
`prisma/seed/test-seed.ts` are for local testing only.

Generate the WAV upload fixtures with:

```sh
python test/prepare-audio-fixtures.py
```

The generated fixtures are ignored by Git; they cover valid, silent, short,
long, oversized RIFF, and non-audio files.
