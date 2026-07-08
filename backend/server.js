const express = require('express');
const cors = require('cors');
const db = require('./db');
const {
  forecastMedicine,
  forecastFootfall,
  regenerateAlerts,
  computePerformanceScore,
  redistributionSuggestions,
  executeTransfer,
  getDistrictStatus,
  getDashboardSummary,
  getCentreRecommendation,
  medicineDemandPrediction,
  doctorAttendanceDetail,
  getCentreTrends,
  chatbotAnswer
} = require('./analytics');

const app = express();
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const today = () => new Date().toISOString().slice(0, 10);

app.get('/api/summary', (req, res) => {
  res.json(getDashboardSummary());
});

app.get('/api/centres', (req, res) => {
  const centres = db.prepare('SELECT * FROM centres').all();
  const t = today();
  const enriched = centres.map(c => {
    const perf = computePerformanceScore(c.id);
    const latestBed = db
      .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
      .get(c.id);
    const stockAlerts = db
      .prepare(
        'SELECT COUNT(*) c FROM medicines WHERE centre_id = ? AND current_stock <= reorder_level'
      )
      .get(c.id).c;
    const doctors = db.prepare('SELECT * FROM doctors WHERE centre_id = ?').all(c.id);
    let doctorsPresentToday = 0;
    doctors.forEach(doc => {
      const latest = db
        .prepare('SELECT present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 1')
        .get(doc.id);
      if (latest && latest.present) doctorsPresentToday++;
    });
    const testsUnavailable = db
      .prepare('SELECT COUNT(*) c FROM tests WHERE centre_id = ? AND available = 0')
      .get(c.id).c;
    const patientsToday =
      db.prepare('SELECT COALESCE(SUM(patient_count),0) s FROM footfall WHERE centre_id = ? AND date = ?').get(c.id, t).s;

    const riskLevel = perf.score < 60 ? 'High' : perf.score < 80 ? 'Medium' : 'Low';

    return {
      ...c,
      performanceScore: perf.score,
      rating: perf.rating,
      healthLabel: perf.healthLabel,
      breakdown: perf.breakdown,
      occupiedBeds: latestBed ? latestBed.occupied_beds : 0,
      lowStockCount: stockAlerts,
      doctorsTotal: doctors.length,
      doctorsPresentToday,
      testsUnavailable,
      patientsToday,
      riskLevel
    };
  });
  res.json(enriched);
});

app.get('/api/centres/:id', (req, res) => {
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(req.params.id);
  if (!centre) return res.status(404).json({ error: 'Centre not found' });
  const medicines = db.prepare('SELECT * FROM medicines WHERE centre_id = ?').all(centre.id);
  const doctors = db.prepare('SELECT * FROM doctors WHERE centre_id = ?').all(centre.id);
  const tests = db.prepare('SELECT * FROM tests WHERE centre_id = ?').all(centre.id);
  const footfall = db
    .prepare('SELECT * FROM footfall WHERE centre_id = ? ORDER BY date ASC')
    .all(centre.id);
  const beds = db.prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date ASC').all(centre.id);
  const perf = computePerformanceScore(centre.id);
  res.json({ centre, medicines, doctors, tests, footfall, beds, performance: perf });
});

app.get('/api/centres/:id/recommendation', (req, res) => {
  const rec = getCentreRecommendation(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Centre not found' });
  res.json(rec);
});

app.get('/api/centres/:id/trends', (req, res) => {
  const trends = getCentreTrends(req.params.id);
  if (!trends) return res.status(404).json({ error: 'Centre not found' });
  res.json(trends);
});

app.put('/api/medicines/:id/stock', (req, res) => {
  const { newStock, consumedToday } = req.body;
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!med) return res.status(404).json({ error: 'Medicine not found' });

  db.prepare('UPDATE medicines SET current_stock = ? WHERE id = ?').run(newStock, med.id);
  db.prepare(
    'INSERT INTO stock_history (medicine_id, date, stock_level, consumed) VALUES (?,?,?,?)'
  ).run(med.id, today(), newStock, consumedToday || 0);

  res.json({ success: true });
});

app.post('/api/centres/:id/medicines', (req, res) => {
  const { name, unit, current_stock, reorder_level } = req.body;
  const result = db
    .prepare(
      'INSERT INTO medicines (centre_id, name, unit, current_stock, reorder_level) VALUES (?,?,?,?,?)'
    )
    .run(req.params.id, name, unit || 'units', current_stock || 0, reorder_level || 20);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/medicines/:id/forecast', (req, res) => {
  const forecast = forecastMedicine(req.params.id);
  if (!forecast) return res.status(404).json({ error: 'Medicine not found' });
  res.json(forecast);
});

app.get('/api/medicines/:id/demand', (req, res) => {
  const demand = medicineDemandPrediction(req.params.id);
  if (!demand) return res.status(404).json({ error: 'Medicine not found' });
  res.json(demand);
});

app.post('/api/centres/:id/footfall', (req, res) => {
  const { patient_count, date } = req.body;
  db.prepare('INSERT INTO footfall (centre_id, date, patient_count) VALUES (?,?,?)').run(
    req.params.id,
    date || today(),
    patient_count
  );
  res.json({ success: true });
});

app.get('/api/centres/:id/footfall/forecast', (req, res) => {
  res.json(forecastFootfall(req.params.id));
});

app.post('/api/centres/:id/beds', (req, res) => {
  const { occupied_beds, date } = req.body;
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(req.params.id);
  if (!centre) return res.status(404).json({ error: 'Centre not found' });
  if (occupied_beds > centre.total_beds) {
    return res.status(400).json({ error: 'occupied_beds exceeds total_beds' });
  }
  db.prepare('INSERT INTO beds (centre_id, date, occupied_beds) VALUES (?,?,?)').run(
    req.params.id,
    date || today(),
    occupied_beds
  );
  res.json({ success: true });
});

app.post('/api/centres/:id/doctors', (req, res) => {
  const { name, specialization } = req.body;
  const result = db
    .prepare('INSERT INTO doctors (centre_id, name, specialization) VALUES (?,?,?)')
    .run(req.params.id, name, specialization || 'General');
  res.json({ id: result.lastInsertRowid });
});

app.post('/api/doctors/:id/attendance', (req, res) => {
  const { present, date } = req.body;
  db.prepare('INSERT INTO doctor_attendance (doctor_id, date, present) VALUES (?,?,?)').run(
    req.params.id,
    date || today(),
    present ? 1 : 0
  );
  res.json({ success: true });
});

app.get('/api/doctors/:id/attendance-detail', (req, res) => {
  const detail = doctorAttendanceDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Doctor not found' });
  res.json(detail);
});

app.put('/api/tests/:id', (req, res) => {
  const { available } = req.body;
  db.prepare('UPDATE tests SET available = ?, last_audit_date = ? WHERE id = ?').run(
    available ? 1 : 0,
    today(),
    req.params.id
  );
  res.json({ success: true });
});

app.post('/api/centres/:id/tests', (req, res) => {
  const { test_name, available } = req.body;
  const result = db
    .prepare(
      'INSERT INTO tests (centre_id, test_name, available, last_audit_date) VALUES (?,?,?,?)'
    )
    .run(req.params.id, test_name, available ? 1 : 0, today());
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/alerts', (req, res) => {
  res.json(regenerateAlerts());
});

app.put('/api/alerts/:id/resolve', (req, res) => {
  db.prepare('UPDATE alerts SET resolved = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/districts/:district/redistribution', (req, res) => {
  res.json(redistributionSuggestions(req.params.district));
});

app.post('/api/redistribution/transfer', (req, res) => {
  const { medicine, fromCentreId, toCentreId, qty } = req.body;
  const result = executeTransfer({ medicine, fromCentreId, toCentreId, qty });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/districts/:district/underperforming', (req, res) => {
  const centres = db.prepare('SELECT * FROM centres WHERE district = ?').all(req.params.district);
  const flagged = centres
    .map(c => ({ centre: c, ...computePerformanceScore(c.id) }))
    .filter(r => r.rating !== 'GOOD')
    .sort((a, b) => a.score - b.score);
  res.json(flagged);
});

app.get('/api/districts/:district/status', (req, res) => {
  res.json(getDistrictStatus(req.params.district));
});

app.get('/api/districts/:district/summary', (req, res) => {
  const centres = db.prepare('SELECT * FROM centres WHERE district = ?').all(req.params.district);
  const centreIds = centres.map(c => c.id);
  if (centreIds.length === 0) return res.json({ centres: 0 });
  const placeholders = centreIds.map(() => '?').join(',');
  const totalLowStock = db
    .prepare(
      `SELECT COUNT(*) c FROM medicines WHERE centre_id IN (${placeholders}) AND current_stock <= reorder_level`
    )
    .get(...centreIds).c;
  const totalPatientsToday = db
    .prepare(
      `SELECT COALESCE(SUM(patient_count),0) s FROM footfall WHERE centre_id IN (${placeholders}) AND date = ?`
    )
    .get(...centreIds, today()).s;
  const avgScore =
    centres.reduce((s, c) => s + computePerformanceScore(c.id).score, 0) / centres.length;

  const scored = centres
    .map(c => ({ centre: c, ...computePerformanceScore(c.id) }))
    .sort((a, b) => b.score - a.score);
  const topPerforming = scored.slice(0, 3);
  const worstPerforming = scored.slice(-3).reverse();

  res.json({
    centres: centres.length,
    totalLowStock,
    totalPatientsToday,
    avgPerformanceScore: Math.round(avgScore),
    topPerforming,
    worstPerforming
  });
});

app.get('/api/chatbot', (req, res) => {
  const { q } = req.query;
  res.json({ question: q, answer: chatbotAnswer(q) });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));