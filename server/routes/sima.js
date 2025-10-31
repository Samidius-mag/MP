const express = require('express');

const router = express.Router();

// Запуск загрузки общего каталога (по статическому токену)
router.post('/sima-land/catalog/load', async (req, res) => {
  try {
    const staticHeader = req.headers['x-static-token'];
    const staticToken = process.env.SIMA_LAND_STATIC_TOKEN;
    if (!staticToken || staticHeader !== staticToken) {
      return res.status(401).json({ error: 'Invalid static token' });
    }

    const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
    const progressStore = require('../services/progressStore');
    const jobId = progressStore.createJob('simaLandCatalogLoad', { categories });
    const SimaLandService = require('../services/simaLandService');
    const simaLandService = new SimaLandService();
    simaLandService.loadCatalog({ categories }, jobId).catch(err => {
      console.error('Catalog load failed:', err);
      progressStore.failJob(jobId, err.message);
    });
    res.status(202).json({ success: true, jobId });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка запуска загрузки каталога' });
  }
});

// Статус задачи загрузки каталога
router.get('/sima-land/catalog/status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId обязателен' });
  const progressStore = require('../services/progressStore');
  const job = progressStore.getJob(String(jobId));
  if (!job) return res.status(404).json({ error: 'Задача не найдена' });
  return res.json(job);
});

module.exports = router;


