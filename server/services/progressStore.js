const { v4: uuidv4 } = require('uuid');

// Простое in-memory хранилище прогресса задач (сбросится при рестарте процесса)
const jobs = new Map();

function createJob(type, metadata = {}) {
  const id = uuidv4();
  const now = new Date().toISOString();
  jobs.set(id, {
    id,
    type,
    status: 'running', // running | completed | failed
    progress: 0, // 0..100
    startedAt: now,
    updatedAt: now,
    metadata,
    details: {}
  });
  return id;
}

function updateJob(id, data = {}) {
  const job = jobs.get(id);
  if (!job) return;
  const updated = {
    ...job,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, updated);
}

function setProgress(id, progress, details = {}) {
  const job = jobs.get(id);
  if (!job) return;
  updateJob(id, { progress: Math.max(0, Math.min(100, Math.floor(progress))), details: { ...job.details, ...details } });
}

function finishJob(id, result = {}) {
  const job = jobs.get(id);
  if (!job) return;
  updateJob(id, { status: 'completed', progress: 100, result });
}

function failJob(id, errorMessage) {
  const job = jobs.get(id);
  if (!job) return;
  updateJob(id, { status: 'failed', error: errorMessage });
}

function getJob(id) {
  return jobs.get(id) || null;
}

function findRunningJobBy(predicate) {
  for (const job of jobs.values()) {
    if (job.status === 'running' && predicate(job)) return job;
  }
  return null;
}

function getRunningImportJobByClient(clientId) {
  return findRunningJobBy(j => j.type === 'simaLandImport' && j.metadata?.clientId === clientId);
}

module.exports = {
  createJob,
  updateJob,
  setProgress,
  finishJob,
  failJob,
  getJob,
  findRunningJobBy,
  getRunningImportJobByClient,
};


