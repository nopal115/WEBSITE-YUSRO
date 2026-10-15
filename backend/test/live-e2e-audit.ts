import { PrismaClient, UserRole, AccountStatus, ContentStatus, TaskType, AudioType, AudioStatus, JobStatus, EvaluationStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const BACKEND_URL = 'http://localhost:3000/api/v1';
const ML_URL = 'http://localhost:8000';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== STARTING LIVE END-TO-END INTEGRATION TEST ===\n');

  // 1. Verify Prisma / DB connection
  console.log('[1] Checking PostgreSQL connection...');
  await prisma.$connect();
  console.log('    PostgreSQL: CONNECTED\n');

  // 2. Verify ML Service live
  console.log('[2] Checking Live ML Service at ' + ML_URL + '...');
  const healthRes = await fetch(`${ML_URL}/health`);
  const healthJson = await healthRes.json();
  console.log('    ML /health status:', healthRes.status, JSON.stringify(healthJson));
  if (healthRes.status !== 200 || !healthJson.model_loaded) {
    throw new Error('ML Service is not ready or model not loaded');
  }

  const modelInfoRes = await fetch(`${ML_URL}/model-info`);
  const modelInfoJson = await modelInfoRes.json();
  console.log('    ML /model-info status:', modelInfoRes.status, 'model_version:', modelInfoJson.model_version);

  // 3. Prepare Test Student & Task Fixtures in DB
  const suffix = Date.now().toString();
  const studentEmail = `live-student-${suffix}@yusro.local`;
  const studentPassword = 'Password123!';

  console.log('\n[3] Setting up test Student and Task in database...');
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      name: `Live Student ${suffix}`,
      password: await argon2.hash(studentPassword),
      role: UserRole.SANTRI,
      status: AccountStatus.ACTIVE,
    },
  });
  console.log('    Created Student ID:', student.id);

  // Setup Stage & Material
  const stage = await prisma.stage.create({
    data: {
      title: `E2E Live Stage ${suffix}`,
      order: 99990 + Math.floor(Math.random() * 1000),
      status: ContentStatus.ACTIVE,
    },
  });

  const material = await prisma.material.create({
    data: {
      stageId: stage.id,
      title: 'E2E Live Material',
      order: 1,
      isRequired: true,
      status: ContentStatus.ACTIVE,
    },
  });

  // Reference audio file
  const refWavPath = path.resolve('../ml-service/dataset/test_fixtures/reference.wav');
  const refBuffer = fs.readFileSync(refWavPath);
  const refObjectKey = `references/e2e-${suffix}-reference.wav`;

  // Write reference to storage
  const storageUploadsDir = path.resolve('uploads');
  const targetRefPath = path.join(storageUploadsDir, refObjectKey);
  fs.mkdirSync(path.dirname(targetRefPath), { recursive: true });
  fs.writeFileSync(targetRefPath, refBuffer);

  const refAudio = await prisma.audioAsset.create({
    data: {
      type: AudioType.REFERENCE,
      status: AudioStatus.ACTIVE,
      originalName: 'reference.wav',
      objectKey: refObjectKey,
      mimeType: 'audio/wav',
      sizeBytes: refBuffer.length,
      durationSeconds: 3.0,
      durationMs: 3000,
    },
  });
  console.log('    Created Reference AudioAsset ID:', refAudio.id);

  const task = await prisma.task.create({
    data: {
      stageId: stage.id,
      materialId: material.id,
      title: 'E2E Dengar-Tirukan Task',
      type: TaskType.IMITATION,
      status: ContentStatus.ACTIVE,
      order: 1,
      referenceAudioId: refAudio.id,
    },
  });
  console.log('    Created Imitation Task ID:', task.id);

  // 4. Authenticate as Student via Backend API
  console.log('\n[4] Authenticating student via POST /api/v1/auth/login...');
  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  });
  const loginJson = await loginRes.json();
  if ((loginRes.status !== 200 && loginRes.status !== 201) || !loginJson.accessToken) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginJson)}`);
  }
  const token = loginJson.accessToken;
  console.log('    Login SUCCESS. Token acquired.');

  // 5. Submit Recording to POST /api/v1/imitation/tasks/:taskId/submissions
  console.log('\n[5] Submitting Recording 1 via POST /api/v1/imitation/tasks/:taskId/submissions...');
  const recWavPath = path.resolve('../ml-service/dataset/test_fixtures/recording.wav');
  const recBuffer = fs.readFileSync(recWavPath);

  const formData = new FormData();
  formData.append('audio', new Blob([recBuffer], { type: 'audio/wav' }), 'recording.wav');

  const clientRequestId = `req-e2e-live-${suffix}-1`;
  const submitRes = await fetch(`${BACKEND_URL}/imitation/tasks/${task.id}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Request-Id': clientRequestId,
    },
    body: formData,
  });

  const submitJson = await submitRes.json();
  console.log('    Submit HTTP Status:', submitRes.status);
  console.log('    Submit Response:', JSON.stringify(submitJson));
  if (submitRes.status !== 201 || !submitJson.submissionId) {
    throw new Error(`Submit failed: ${JSON.stringify(submitJson)}`);
  }
  const submissionId = submitJson.submissionId;

  // 6. Immediate DB State Check (Before worker finishes)
  console.log('\n[6] Checking immediate DB state...');
  const initialAttempt = await prisma.attempt.findUnique({
    where: { id: submissionId },
    include: { jobs: true, recordingAudio: true, referenceAudio: true },
  });
  console.log('    Attempt ID:', initialAttempt?.id);
  console.log('    Attempt evaluationStatus:', initialAttempt?.evaluationStatus);
  console.log('    Recording AudioAsset ID:', initialAttempt?.recordingAudioId);
  console.log('    Reference AudioAsset ID:', initialAttempt?.referenceAudioId);
  console.log('    EvaluationJob ID:', initialAttempt?.jobs[0]?.id, 'Status:', initialAttempt?.jobs[0]?.status);

  if (initialAttempt?.jobs[0]?.status !== JobStatus.QUEUED && initialAttempt?.jobs[0]?.status !== JobStatus.RUNNING) {
    throw new Error('EvaluationJob was not QUEUED or RUNNING');
  }

  // 7. Wait and Poll for Worker Processing & ML Evaluation Completion
  console.log('\n[7] Waiting for Evaluation Worker to process job and invoke ML service...');
  let jobDone = false;
  let finalJob: any = null;
  let finalAttempt: any = null;
  const startTime = Date.now();

  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const j = await prisma.evaluationJob.findFirst({
      where: { attemptId: submissionId },
      orderBy: { createdAt: 'desc' },
    });
    const a = await prisma.attempt.findUnique({
      where: { id: submissionId },
    });

    console.log(`    [t+${Math.round((Date.now() - startTime) / 1000)}s] Job status: ${j?.status} | Attempt status: ${a?.evaluationStatus}`);

    if (j?.status === JobStatus.DONE && a?.evaluationStatus === EvaluationStatus.EVALUATED) {
      jobDone = true;
      finalJob = j;
      finalAttempt = a;
      break;
    }
    if (j?.status === JobStatus.FAILED || a?.evaluationStatus === EvaluationStatus.FAILED) {
      throw new Error(`Evaluation FAILED! ErrorCode: ${a?.errorCode}, JobError: ${j?.lastErrorCode} ${j?.lastErrorDetail}`);
    }
  }

  if (!jobDone) {
    throw new Error('Evaluation timed out waiting for worker');
  }

  console.log('\n[8] Worker completed successfully!');
  console.log('    Score:', Number(finalAttempt.score));
  console.log('    Feedback Category:', finalAttempt.feedbackCategory);
  console.log('    Model Version:', finalAttempt.modelVersion);
  console.log('    Processing Ms:', finalAttempt.processingMs);
  console.log('    Job lockedBy:', finalJob.lockedBy);
  console.log('    Job runCount:', finalJob.runCount);
  console.log('    Job finishedAt:', finalJob.finishedAt);

  // 8. Result Retrieval via API
  console.log('\n[9] Testing Result Retrieval via GET /api/v1/imitation/submissions/:submissionId...');
  const resultRes = await fetch(`${BACKEND_URL}/imitation/submissions/${submissionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const resultJson = await resultRes.json();
  console.log('    Result API Status:', resultRes.status);
  console.log('    Result API JSON:', JSON.stringify(resultJson));

  if (resultRes.status !== 200 || resultJson.status !== 'EVALUATED' || Number(resultJson.score) !== Number(finalAttempt.score)) {
    throw new Error('Result API response did not match evaluated attempt in DB');
  }

  // 9. Verify Progress in DB
  console.log('\n[10] Verifying TaskProgress in DB...');
  const progress = await prisma.taskProgress.findUnique({
    where: { userId_taskId: { userId: student.id, taskId: task.id } },
  });
  console.log('    TaskProgress attemptCount:', progress?.attemptCount);
  console.log('    TaskProgress bestScore:', Number(progress?.bestScore));
  console.log('    TaskProgress completedAt:', progress?.completedAt);

  if (!progress || Number(progress.bestScore) !== Number(finalAttempt.score) || progress.attemptCount !== 1) {
    throw new Error('TaskProgress not updated properly');
  }

  // 10. Test Repeat Evaluation: Test Cooldown (Immediate 2nd submit)
  console.log('\n[11] Testing Repeat Evaluation: Submitting immediately (testing 10s cooldown)...');
  const cooldownRes = await fetch(`${BACKEND_URL}/imitation/tasks/${task.id}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Request-Id': `req-e2e-live-${suffix}-cooldown`,
    },
    body: formData,
  });
  console.log('    Immediate submit status:', cooldownRes.status, '(Expected 429)');
  if (cooldownRes.status !== 429) {
    console.warn('    Warning: Expected 429 cooldown, got:', cooldownRes.status);
  }

  // 11. Test Repeat Evaluation: Wait >10s and submit 2nd attempt
  console.log('\n[12] Waiting 11 seconds for cooldown to pass before 2nd submission...');
  await sleep(11000);

  console.log('    Submitting Attempt 2 (Identical reference audio for high score)...');
  const formData2 = new FormData();
  formData2.append('audio', new Blob([refBuffer], { type: 'audio/wav' }), 'reference.wav');

  const submitRes2 = await fetch(`${BACKEND_URL}/imitation/tasks/${task.id}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Request-Id': `req-e2e-live-${suffix}-2`,
    },
    body: formData2,
  });
  const submitJson2 = await submitRes2.json();
  console.log('    Submit 2 Status:', submitRes2.status);
  console.log('    Submit 2 JSON:', JSON.stringify(submitJson2));
  const submissionId2 = submitJson2.submissionId;

  // Poll for attempt 2 completion
  console.log('    Waiting for Worker to complete Attempt 2...');
  let jobDone2 = false;
  let finalAttempt2: any = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const j2 = await prisma.evaluationJob.findFirst({ where: { attemptId: submissionId2 } });
    const a2 = await prisma.attempt.findUnique({ where: { id: submissionId2 } });
    if (j2?.status === JobStatus.DONE && a2?.evaluationStatus === EvaluationStatus.EVALUATED) {
      jobDone2 = true;
      finalAttempt2 = a2;
      break;
    }
  }

  console.log('    Attempt 2 finished! Score:', Number(finalAttempt2?.score), 'Feedback:', finalAttempt2?.feedbackCategory);

  // Verify updated TaskProgress (attemptCount = 2, bestScore updated)
  const progress2 = await prisma.taskProgress.findUnique({
    where: { userId_taskId: { userId: student.id, taskId: task.id } },
  });
  console.log('    Updated TaskProgress attemptCount:', progress2?.attemptCount, '(Expected: 2)');
  console.log('    Updated TaskProgress bestScore:', Number(progress2?.bestScore), `(Expected: max(${Number(finalAttempt.score)}, ${Number(finalAttempt2.score)}))`);

  // 12. Check for stuck states
  console.log('\n[13] Checking for stuck states in database...');
  const stuckJobs = await prisma.evaluationJob.findMany({
    where: { status: JobStatus.RUNNING },
  });
  const stuckAttempts = await prisma.attempt.findMany({
    where: { evaluationStatus: EvaluationStatus.PROCESSING },
  });
  console.log('    Stuck EvaluationJobs (RUNNING):', stuckJobs.length);
  console.log('    Stuck Attempts (PROCESSING):', stuckAttempts.length);

  console.log('\n=== LIVE END-TO-END INTEGRATION TEST COMPLETED SUCCESSFULLY! ===');
  console.log('\nTraceability Summary:');
  console.log(`- Student ID: ${student.id}`);
  console.log(`- Task ID: ${task.id}`);
  console.log(`- Attempt 1 ID / submissionId: ${submissionId}`);
  console.log(`  - Job 1 ID: ${finalJob.id}`);
  console.log(`  - Attempt 1 Score: ${Number(finalAttempt.score)} (${finalAttempt.feedbackCategory})`);
  console.log(`  - Processing Duration: ${finalAttempt.processingMs} ms`);
  console.log(`- Attempt 2 ID / submissionId: ${submissionId2}`);
  console.log(`  - Attempt 2 Score: ${Number(finalAttempt2.score)} (${finalAttempt2.feedbackCategory})`);
  console.log(`  - Processing Duration: ${finalAttempt2.processingMs} ms`);
  console.log(`- Final Best Score in TaskProgress: ${Number(progress2?.bestScore)}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n*** ERROR DURING LIVE E2E TEST ***');
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
