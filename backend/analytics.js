const db = require('./db');

/* =========================================================================
   EXISTING CORE ANALYTICS (kept intact, only computePerformanceScore
   extended to also return a category breakdown used by the new UI)
   ========================================================================= */

function forecastMedicine(medicineId) {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId);
  if (!med) return null;

  const history = db
    .prepare('SELECT date, stock_level, consumed FROM stock_history WHERE medicine_id = ? ORDER BY date ASC')
    .all(medicineId);

  if (history.length < 2) {
    return { medicine: med, avgDailyConsumption: 0, daysToStockout: null, forecast: [] };
  }

  const totalConsumed = history.reduce((s, h) => s + h.consumed, 0);
  const avgDailyConsumption = totalConsumed / history.length;

  const daysToStockout =
    avgDailyConsumption > 0 ? Math.floor(med.current_stock / avgDailyConsumption) : null;

  const forecast = [];
  let projected = med.current_stock;
  for (let i = 1; i <= 7; i++) {
    projected = Math.max(0, projected - avgDailyConsumption);
    forecast.push({ dayOffset: i, projectedStock: Math.round(projected) });
  }

  return {
    medicine: med,
    avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
    daysToStockout,
    forecast
  };
}

/** Forecast footfall demand using a simple moving average + trend, returns full 7-day breakdown */
function forecastFootfall(centreId) {
  const rows = db
    .prepare('SELECT date, patient_count FROM footfall WHERE centre_id = ? ORDER BY date ASC')
    .all(centreId);
  if (rows.length === 0) {
    return { avg: 0, trend: 0, nextWeekEstimate: 0, dailyForecast: [] };
  }

  const n = rows.length;
  const avg = rows.reduce((s, r) => s + r.patient_count, 0) / n;

  const xs = rows.map((_, i) => i);
  const ys = rows.map(r => r.patient_count);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const nextWeekEstimate = Math.max(0, Math.round(avg + slope * 7));

  const lastDate = new Date(rows[rows.length - 1].date);
  const dailyForecast = [];
  for (let i = 1; i <= 7; i++) {
    const projected = Math.max(0, Math.round(avg + slope * (n - 1 + i)));
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    dailyForecast.push({
      dayOffset: i,
      date: d.toISOString().slice(0, 10),
      label: i === 1 ? 'Tomorrow' : `Day ${i}`,
      projectedPatients: projected,
      busy: projected > avg * 1.15
    });
  }

  return {
    avg: Math.round(avg),
    trend: Math.round(slope * 100) / 100,
    nextWeekEstimate,
    dailyForecast
  };
}

/**
 * Medicine demand prediction — richer than forecastMedicine.
 * Computes expected weekly requirement, predicted shortage, a confidence
 * score (based on consistency of past consumption) and a recommended
 * restock quantity.
 */
function medicineDemandPrediction(medicineId) {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId);
  if (!med) return null;

  const history = db
    .prepare('SELECT date, consumed FROM stock_history WHERE medicine_id = ? ORDER BY date ASC')
    .all(medicineId);

  if (history.length === 0) {
    return {
      medicine: med,
      avgDailyConsumption: 0,
      weeklyRequirement: 0,
      predictedShortage: 0,
      confidence: 0,
      recommendedRestock: 0,
      urgency: 'LOW'
    };
  }

  const consumptions = history.map(h => h.consumed);
  const avgDailyConsumption = consumptions.reduce((a, b) => a + b, 0) / consumptions.length;
  const weeklyRequirement = Math.round(avgDailyConsumption * 7);

  const variance =
    consumptions.reduce((s, c) => s + (c - avgDailyConsumption) ** 2, 0) / consumptions.length;
  const stdDev = Math.sqrt(variance);
  const coefVariation = avgDailyConsumption > 0 ? stdDev / avgDailyConsumption : 1;
  const confidence = Math.max(50, Math.min(99, Math.round(100 - coefVariation * 60)));

  const predictedShortage = Math.max(0, weeklyRequirement - med.current_stock);
  const recommendedRestock =
    predictedShortage > 0 ? predictedShortage + med.reorder_level : Math.max(0, med.reorder_level - med.current_stock);

  let urgency = 'LOW';
  if (med.current_stock <= 0) urgency = 'CRITICAL';
  else if (predictedShortage > 0 && predictedShortage >= med.current_stock) urgency = 'HIGH';
  else if (med.current_stock <= med.reorder_level) urgency = 'MEDIUM';

  return {
    medicine: med,
    avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
    weeklyRequirement,
    predictedShortage,
    confidence,
    recommendedRestock,
    urgency
  };
}

/** Recompute all live alerts (stock-out, bed, doctor absenteeism, missing tests) */
function regenerateAlerts() {
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM alerts WHERE resolved = 0`).run();

  const insertAlert = db.prepare(
    'INSERT INTO alerts (centre_id, type, severity, message, created_at) VALUES (?,?,?,?,?)'
  );

  const meds = db.prepare('SELECT * FROM medicines').all();
  meds.forEach(m => {
    if (m.current_stock <= 0) {
      insertAlert.run(m.centre_id, 'STOCKOUT', 'HIGH', `${m.name} is OUT OF STOCK`, now);
    } else if (m.current_stock <= m.reorder_level) {
      const { daysToStockout } = forecastMedicine(m.id) || {};
      insertAlert.run(
        m.centre_id,
        'STOCKOUT',
        'MEDIUM',
        `${m.name} low (${m.current_stock} ${m.unit} left${
          daysToStockout != null ? `, ~${daysToStockout} days to stock-out` : ''
        })`,
        now
      );
    }
  });

  const centres = db.prepare('SELECT * FROM centres').all();
  centres.forEach(c => {
    const latestBed = db
      .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
      .get(c.id);
    if (latestBed) {
      const occupancyRate = latestBed.occupied_beds / c.total_beds;
      if (occupancyRate >= 0.9) {
        insertAlert.run(
          c.id,
          'BED',
          'HIGH',
          `Bed occupancy critical: ${latestBed.occupied_beds}/${c.total_beds} beds occupied`,
          now
        );
      } else if (occupancyRate >= 0.75) {
        insertAlert.run(
          c.id,
          'BED',
          'MEDIUM',
          `Bed occupancy high: ${latestBed.occupied_beds}/${c.total_beds} beds occupied`,
          now
        );
      }
    }
  });

  centres.forEach(c => {
    const doctors = db.prepare('SELECT * FROM doctors WHERE centre_id = ?').all(c.id);
    doctors.forEach(doc => {
      const att = db
        .prepare('SELECT present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 7')
        .all(doc.id);
      if (att.length === 0) return;
      const presentDays = att.filter(a => a.present).length;
      const rate = presentDays / att.length;
      if (rate < 0.6) {
        insertAlert.run(
          c.id,
          'DOCTOR',
          rate < 0.4 ? 'HIGH' : 'MEDIUM',
          `${doc.name} attendance low: present ${presentDays}/${att.length} days this week`,
          now
        );
      }
    });
    if (doctors.length === 0) {
      insertAlert.run(c.id, 'DOCTOR', 'HIGH', 'No doctor assigned to this centre', now);
    }
  });

  const tests = db.prepare('SELECT * FROM tests WHERE available = 0').all();
  tests.forEach(t => {
    insertAlert.run(t.centre_id, 'TEST', 'MEDIUM', `${t.test_name} unavailable at centre`, now);
  });

  centres.forEach(c => {
    const score = computePerformanceScore(c.id);
    if (score.rating === 'UNDERPERFORMING') {
      insertAlert.run(
        c.id,
        'PERFORMANCE',
        'HIGH',
        `Centre flagged as underperforming (score ${score.score}/100): ${score.reasons.join('; ')}`,
        now
      );
    }
  });

  return db.prepare('SELECT * FROM alerts ORDER BY severity DESC, created_at DESC').all();
}

/**
 * Composite AI Health Score 0-100 for a centre, now with a full
 * category breakdown (each 0-100, higher = better).
 */
function computePerformanceScore(centreId) {
  const reasons = [];
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(centreId);

  const meds = db.prepare('SELECT * FROM medicines WHERE centre_id = ?').all(centreId);
  const stockoutCount = meds.filter(m => m.current_stock <= m.reorder_level).length;
  const medicineAvailability =
    meds.length === 0 ? 100 : Math.round(((meds.length - stockoutCount) / meds.length) * 100);
  if (stockoutCount > 0) reasons.push(`${stockoutCount} medicine(s) low/out of stock`);

  const doctors = db.prepare('SELECT * FROM doctors WHERE centre_id = ?').all(centreId);
  let doctorAttendance = 100;
  if (doctors.length === 0) {
    doctorAttendance = 0;
    reasons.push('no doctor assigned');
  } else {
    let rateSum = 0, rateCount = 0;
    doctors.forEach(doc => {
      const att = db
        .prepare('SELECT present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 7')
        .all(doc.id);
      if (att.length) {
        const rate = att.filter(a => a.present).length / att.length;
        rateSum += rate;
        rateCount++;
        if (rate < 0.6) reasons.push(`${doc.name} low attendance`);
      }
    });
    doctorAttendance = rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 100;
  }

  const latestBed = db
    .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
    .get(centreId);
  let bedUtilization = 100;
  let occupancyRate = null;
  if (latestBed && centre) {
    occupancyRate = latestBed.occupied_beds / centre.total_beds;
    bedUtilization = Math.max(0, Math.round(100 - Math.abs(occupancyRate - 0.7) * 150));
    if (occupancyRate >= 0.9) reasons.push('critical bed occupancy');
    else if (occupancyRate >= 0.75) reasons.push('high bed occupancy');
  }

  const totalTests = db.prepare('SELECT COUNT(*) c FROM tests WHERE centre_id = ?').get(centreId).c;
  const unavailableTests = db
    .prepare('SELECT COUNT(*) c FROM tests WHERE centre_id = ? AND available = 0')
    .get(centreId).c;
  const testAvailability =
    totalTests === 0 ? 100 : Math.round(((totalTests - unavailableTests) / totalTests) * 100);
  if (unavailableTests > 0) reasons.push(`${unavailableTests} test(s) unavailable`);

  const footfallRows = db
    .prepare('SELECT patient_count FROM footfall WHERE centre_id = ? ORDER BY date DESC LIMIT 7')
    .all(centreId);
  let patientLoadManagement = 100;
  if (footfallRows.length > 0) {
    const avgFootfall = footfallRows.reduce((s, r) => s + r.patient_count, 0) / footfallRows.length;
    const capacity = Math.max(1, doctors.length * 20 + (centre ? centre.total_beds : 0) * 5);
    const loadRatio = avgFootfall / capacity;
    patientLoadManagement = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, loadRatio - 1) * 100)));
    if (loadRatio > 1.2) reasons.push('patient load exceeds centre capacity');
  }

  const breakdown = {
    medicineAvailability,
    doctorAttendance,
    bedUtilization,
    testAvailability,
    patientLoadManagement
  };

  const score = Math.round(
    medicineAvailability * 0.25 +
      doctorAttendance * 0.25 +
      bedUtilization * 0.2 +
      testAvailability * 0.15 +
      patientLoadManagement * 0.15
  );

  const rating = score < 60 ? 'UNDERPERFORMING' : score < 80 ? 'NEEDS_ATTENTION' : 'GOOD';
  const healthLabel = score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : score >= 55 ? 'NEEDS_ATTENTION' : 'CRITICAL';

  return { score, rating, reasons, breakdown, healthLabel, occupancyRate };
}

function redistributionSuggestions(district) {
  const centres = db.prepare('SELECT * FROM centres WHERE district = ?').all(district);
  const centreIds = centres.map(c => c.id);
  if (centreIds.length === 0) return [];

  const placeholders = centreIds.map(() => '?').join(',');
  const meds = db
    .prepare(`SELECT * FROM medicines WHERE centre_id IN (${placeholders})`)
    .all(...centreIds);

  const byName = {};
  meds.forEach(m => {
    byName[m.name] = byName[m.name] || [];
    byName[m.name].push(m);
  });

  const suggestions = [];
  Object.entries(byName).forEach(([name, list]) => {
    const deficit = list.filter(m => m.current_stock <= m.reorder_level);
    const surplus = list
      .filter(m => m.current_stock > m.reorder_level * 2)
      .sort((a, b) => b.current_stock - a.current_stock);

    deficit.forEach(d => {
      const donor = surplus.find(s => s.centre_id !== d.centre_id && s.current_stock > s.reorder_level);
      if (donor) {
        const transferQty = Math.min(
          donor.current_stock - donor.reorder_level,
          Math.max(1, d.reorder_level - d.current_stock + 10)
        );
        if (transferQty > 0) {
          const fromCentre = centres.find(c => c.id === donor.centre_id);
          const toCentre = centres.find(c => c.id === d.centre_id);
          const reason =
            d.current_stock <= 0
              ? `${name} out of stock`
              : `${name} below reorder level (${d.current_stock}/${d.reorder_level})`;
          const estImprovement = Math.min(20, Math.round(transferQty / Math.max(1, d.reorder_level) * 15));
          suggestions.push({
            id: `${donor.id}-${d.id}`,
            medicine: name,
            medicineId: d.id,
            fromCentre: fromCentre?.name,
            fromCentreId: donor.centre_id,
            toCentre: toCentre?.name,
            toCentreId: d.centre_id,
            suggestedQty: transferQty,
            reason,
            estImprovement
          });
        }
      }
    });
  });

  return suggestions;
}

function executeTransfer({ medicine, fromCentreId, toCentreId, qty }) {
  const today = new Date().toISOString().slice(0, 10);
  const fromMed = db
    .prepare('SELECT * FROM medicines WHERE centre_id = ? AND name = ?')
    .get(fromCentreId, medicine);
  const toMed = db
    .prepare('SELECT * FROM medicines WHERE centre_id = ? AND name = ?')
    .get(toCentreId, medicine);
  if (!fromMed || !toMed) return { success: false, error: 'Medicine record not found at one of the centres' };

  const transferQty = Math.min(qty, fromMed.current_stock);
  const newFromStock = Math.max(0, fromMed.current_stock - transferQty);
  const newToStock = toMed.current_stock + transferQty;

  db.prepare('UPDATE medicines SET current_stock = ? WHERE id = ?').run(newFromStock, fromMed.id);
  db.prepare('UPDATE medicines SET current_stock = ? WHERE id = ?').run(newToStock, toMed.id);

  db.prepare(
    'INSERT INTO stock_history (medicine_id, date, stock_level, consumed) VALUES (?,?,?,?)'
  ).run(fromMed.id, today, newFromStock, transferQty);
  db.prepare(
    'INSERT INTO stock_history (medicine_id, date, stock_level, consumed) VALUES (?,?,?,?)'
  ).run(toMed.id, today, newToStock, 0);

  return { success: true, transferredQty: transferQty, fromStock: newFromStock, toStock: newToStock };
}

function getDistrictStatus(district) {
  const centres = db.prepare('SELECT * FROM centres WHERE district = ?').all(district);
  const centreIds = centres.map(c => c.id);
  if (centreIds.length === 0) {
    return { criticalCentres: 0, lowStockMedicines: 0, doctorsAbsent: 0, bedsAvailable: 0, unavailableTests: 0 };
  }
  const placeholders = centreIds.map(() => '?').join(',');

  const criticalCentres = centres.filter(c => computePerformanceScore(c.id).rating === 'UNDERPERFORMING').length;

  const lowStockMedicines = db
    .prepare(
      `SELECT COUNT(*) c FROM medicines WHERE centre_id IN (${placeholders}) AND current_stock <= reorder_level`
    )
    .get(...centreIds).c;

  const doctors = db.prepare(`SELECT * FROM doctors WHERE centre_id IN (${placeholders})`).all(...centreIds);
  let doctorsAbsent = 0;
  doctors.forEach(doc => {
    const latest = db
      .prepare('SELECT present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 1')
      .get(doc.id);
    if (latest && !latest.present) doctorsAbsent++;
  });

  let bedsAvailable = 0;
  centres.forEach(c => {
    const latestBed = db
      .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
      .get(c.id);
    bedsAvailable += c.total_beds - (latestBed ? latestBed.occupied_beds : 0);
  });

  const unavailableTests = db
    .prepare(`SELECT COUNT(*) c FROM tests WHERE centre_id IN (${placeholders}) AND available = 0`)
    .get(...centreIds).c;

  return { criticalCentres, lowStockMedicines, doctorsAbsent, bedsAvailable, unavailableTests };
}

function getDashboardSummary() {
  const centres = db.prepare('SELECT * FROM centres').all();
  const today = new Date().toISOString().slice(0, 10);

  const activeAlerts = db.prepare('SELECT COUNT(*) c FROM alerts WHERE resolved = 0').get().c;

  const totalPatientsToday =
    db.prepare('SELECT COALESCE(SUM(patient_count),0) s FROM footfall WHERE date = ?').get(today).s;

  let availableBeds = 0;
  centres.forEach(c => {
    const latestBed = db
      .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
      .get(c.id);
    availableBeds += c.total_beds - (latestBed ? latestBed.occupied_beds : 0);
  });

  const doctors = db.prepare('SELECT * FROM doctors').all();
  let doctorsPresentToday = 0;
  doctors.forEach(doc => {
    const latest = db
      .prepare('SELECT present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 1')
      .get(doc.id);
    if (latest && latest.present) doctorsPresentToday++;
  });

  const lowStockMedicines = db
    .prepare('SELECT COUNT(*) c FROM medicines WHERE current_stock <= reorder_level')
    .get().c;

  const avgHealthScore =
    centres.length === 0
      ? 0
      : Math.round(centres.reduce((s, c) => s + computePerformanceScore(c.id).score, 0) / centres.length);

  return {
    totalCentres: centres.length,
    activeAlerts,
    totalPatientsToday,
    availableBeds,
    doctorsPresentToday,
    totalDoctors: doctors.length,
    lowStockMedicines,
    avgHealthScore
  };
}

function getCentreRecommendation(centreId) {
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(centreId);
  if (!centre) return null;
  const perf = computePerformanceScore(centreId);

  const reasons = [...perf.reasons];
  const recommendations = [];

  const allSuggestions = redistributionSuggestions(centre.district).filter(s => s.toCentreId === centreId);
  allSuggestions.forEach(s => {
    recommendations.push(`Transfer ${s.suggestedQty} ${s.medicine} from ${s.fromCentre}`);
  });

  const doctors = db.prepare('SELECT * FROM doctors WHERE centre_id = ?').all(centreId);
  if (doctors.length === 0 || perf.breakdown.doctorAttendance < 60) {
    recommendations.push('Assign one temporary doctor to stabilize coverage');
  }

  if (perf.occupancyRate != null && perf.occupancyRate >= 0.85) {
    const sameDistrict = db
      .prepare('SELECT * FROM centres WHERE district = ? AND id != ?')
      .all(centre.district, centreId);
    let bestAlt = null, bestRate = 1;
    sameDistrict.forEach(c => {
      const latestBed = db
        .prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1')
        .get(c.id);
      const rate = latestBed ? latestBed.occupied_beds / c.total_beds : 0;
      if (rate < bestRate) {
        bestRate = rate;
        bestAlt = c;
      }
    });
    if (bestAlt) recommendations.push(`Shift overflow patients to ${bestAlt.name}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('No corrective action needed — centre is operating within healthy parameters');
  }

  const riskLevel = perf.score < 60 ? 'High' : perf.score < 80 ? 'Medium' : 'Low';
  const estImprovement = Math.min(95, perf.score + Math.min(30, recommendations.length * 10));

  return {
    centre,
    riskLevel,
    currentScore: perf.score,
    healthLabel: perf.healthLabel,
    reasons: reasons.length ? reasons : ['No significant issues detected'],
    recommendations,
    projectedScore: estImprovement
  };
}

function doctorAttendanceDetail(doctorId) {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) return null;

  const weekly = db
    .prepare('SELECT date, present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 7')
    .all(doctorId);
  const monthly = db
    .prepare('SELECT date, present FROM doctor_attendance WHERE doctor_id = ? ORDER BY date DESC LIMIT 30')
    .all(doctorId);

  const weeklyRate = weekly.length ? Math.round((weekly.filter(a => a.present).length / weekly.length) * 100) : 0;
  const monthlyRate = monthly.length ? Math.round((monthly.filter(a => a.present).length / monthly.length) * 100) : 0;

  return {
    doctor,
    weeklyRate,
    monthlyRate,
    calendar: monthly.slice().reverse(),
    warning: weeklyRate < 60
  };
}

function getCentreTrends(centreId) {
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(centreId);
  if (!centre) return null;

  const medIds = db.prepare('SELECT id FROM medicines WHERE centre_id = ?').all(centreId).map(m => m.id);
  let medicineConsumption = [];
  if (medIds.length) {
    const placeholders = medIds.map(() => '?').join(',');
    medicineConsumption = db
      .prepare(
        `SELECT date, SUM(consumed) as total FROM stock_history WHERE medicine_id IN (${placeholders}) GROUP BY date ORDER BY date ASC`
      )
      .all(...medIds);
  }

  const bedsRaw = db.prepare('SELECT date, occupied_beds FROM beds WHERE centre_id = ? ORDER BY date ASC').all(centreId);
  const bedOccupancy = bedsRaw.map(b => ({
    date: b.date,
    occupancyRate: Math.round((b.occupied_beds / centre.total_beds) * 100)
  }));

  const docIds = db.prepare('SELECT id FROM doctors WHERE centre_id = ?').all(centreId).map(d => d.id);
  let doctorAttendance = [];
  if (docIds.length) {
    const placeholders = docIds.map(() => '?').join(',');
    doctorAttendance = db
      .prepare(
        `SELECT date, ROUND(AVG(present) * 100) as rate FROM doctor_attendance WHERE doctor_id IN (${placeholders}) GROUP BY date ORDER BY date ASC`
      )
      .all(...docIds);
  }

  const footfall = db
    .prepare('SELECT date, patient_count FROM footfall WHERE centre_id = ? ORDER BY date ASC')
    .all(centreId);

  return { medicineConsumption, bedOccupancy, doctorAttendance, footfall };
}

function chatbotAnswer(question) {
  const q = (question || '').toLowerCase();
  const centres = db.prepare('SELECT * FROM centres').all();

  const findCentreByName = () => centres.find(c => q.includes(c.name.toLowerCase().split(' ')[0].toLowerCase()));

  const medMatch = db.prepare('SELECT DISTINCT name FROM medicines').all().find(m => q.includes(m.name.toLowerCase()));
  if (medMatch && (q.includes('need') || q.includes('low') || q.includes('which') || q.includes('short'))) {
    const rows = db
      .prepare('SELECT m.*, c.name as centre_name FROM medicines m JOIN centres c ON c.id = m.centre_id WHERE m.name = ? AND m.current_stock <= m.reorder_level')
      .all(medMatch.name);
    if (rows.length === 0) {
      return `All centres currently have healthy stock of ${medMatch.name}.`;
    }
    return `These centres need ${medMatch.name}: ${rows
      .map(r => `${r.centre_name} (${r.current_stock}/${r.reorder_level})`)
      .join(', ')}.`;
  }

  if (q.includes('highest patient') || q.includes('most patient') || (q.includes('patient') && q.includes('load'))) {
    let best = null, bestAvg = -1;
    centres.forEach(c => {
      const rows = db.prepare('SELECT patient_count FROM footfall WHERE centre_id = ? ORDER BY date DESC LIMIT 7').all(c.id);
      if (rows.length) {
        const avg = rows.reduce((s, r) => s + r.patient_count, 0) / rows.length;
        if (avg > bestAvg) { bestAvg = avg; best = c; }
      }
    });
    return best ? `${best.name} has the highest average patient load (~${Math.round(bestAvg)} patients/day).` : 'No footfall data available yet.';
  }

  if (q.includes('underperform') && !findCentreByName()) {
    const flagged = centres
      .map(c => ({ c, perf: computePerformanceScore(c.id) }))
      .filter(r => r.perf.rating !== 'GOOD');
    if (flagged.length === 0) return 'No centres are currently underperforming. All centres are in good standing.';
    return `Underperforming / needs-attention centres: ${flagged.map(f => `${f.c.name} (${f.perf.score}/100)`).join(', ')}.`;
  }

  const namedCentre = findCentreByName();
  if (namedCentre && (q.includes('why') || q.includes('underperform') || q.includes('score'))) {
    const perf = computePerformanceScore(namedCentre.id);
    return `${namedCentre.name} has an AI Health Score of ${perf.score}/100 (${perf.rating.replace('_', ' ')}). Reasons: ${perf.reasons.join('; ') || 'none — performing well'}.`;
  }

  if (q.includes('redistribut') || (q.includes('suggest') && q.includes('medicine'))) {
    const suggestions = [...new Set(centres.map(c => c.district))].flatMap(d => redistributionSuggestions(d));
    if (suggestions.length === 0) return 'No redistribution actions are currently needed across the district.';
    return `Suggested transfers: ${suggestions
      .slice(0, 5)
      .map(s => `${s.suggestedQty} ${s.medicine} from ${s.fromCentre} to ${s.toCentre}`)
      .join('; ')}.`;
  }

  if (q.includes('bed') && (q.includes('available') || q.includes('free'))) {
    const rows = centres.map(c => {
      const latestBed = db.prepare('SELECT * FROM beds WHERE centre_id = ? ORDER BY date DESC LIMIT 1').get(c.id);
      const occupied = latestBed ? latestBed.occupied_beds : 0;
      return { name: c.name, available: c.total_beds - occupied };
    }).filter(r => r.available > 0).sort((a, b) => b.available - a.available);
    if (rows.length === 0) return 'No centres currently have free beds.';
    return `Centres with available beds: ${rows.map(r => `${r.name} (${r.available} free)`).join(', ')}.`;
  }

  return "I can help with questions like: 'Which PHC needs insulin?', 'Which hospital has highest patient load?', 'Show underperforming centres', 'Suggest medicine redistribution', 'Which hospitals have beds available?' or 'Why is <centre name> underperforming?'";
}

module.exports = {
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
};