const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'health.db'));
db.pragma('journal_mode = WAL');

// ---------- SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS centres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- PHC or CHC
  district TEXT NOT NULL,
  total_beds INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'units',
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 20,
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);

CREATE TABLE IF NOT EXISTS stock_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  stock_level INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE TABLE IF NOT EXISTS footfall (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  patient_count INTEGER NOT NULL,
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);

CREATE TABLE IF NOT EXISTS beds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  occupied_beds INTEGER NOT NULL,
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  specialization TEXT DEFAULT 'General',
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);

CREATE TABLE IF NOT EXISTS doctor_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  present INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  test_name TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  last_audit_date TEXT,
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centre_id INTEGER NOT NULL,
  type TEXT NOT NULL,             -- STOCKOUT | BED | DOCTOR | TEST | PERFORMANCE
  severity TEXT NOT NULL,         -- LOW | MEDIUM | HIGH
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (centre_id) REFERENCES centres(id)
);
`);

// ---------- SEED (only if empty) ----------
const centreCount = db.prepare('SELECT COUNT(*) c FROM centres').get().c;

if (centreCount === 0) {
  console.log('Seeding database with sample data...');

  const insertCentre = db.prepare(
    'INSERT INTO centres (name, type, district, total_beds) VALUES (?,?,?,?)'
  );
  const centres = [
    ['Anna Nagar PHC', 'PHC', 'Chennai', 10],
    ['Velachery CHC', 'CHC', 'Chennai', 30],
    ['Tambaram PHC', 'PHC', 'Chennai', 12],
    ['Guindy PHC', 'PHC', 'Chennai', 8],
    ['Perungudi CHC', 'CHC', 'Chennai', 25]
  ];
  const centreIds = centres.map(c => insertCentre.run(...c).lastInsertRowid);

  const medicineNames = [
    ['Paracetamol', 'strips', 15, 20],
    ['ORS Packets', 'packets', 60, 30],
    ['Amoxicillin', 'strips', 8, 15],
    ['Iron Folic Acid', 'tablets', 100, 25],
    ['Insulin', 'vials', 5, 10]
  ];
  const insertMed = db.prepare(
    'INSERT INTO medicines (centre_id, name, unit, current_stock, reorder_level) VALUES (?,?,?,?,?)'
  );
  const insertStockHist = db.prepare(
    'INSERT INTO stock_history (medicine_id, date, stock_level, consumed) VALUES (?,?,?,?)'
  );

  const today = new Date();
  function dateStr(offsetDays) {
    const d = new Date(today);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
  }

  centreIds.forEach((centreId, ci) => {
    medicineNames.forEach(([name, unit, baseStock, reorder]) => {
      const variance = (ci % 3) * 8 - 8;
      const stock = Math.max(0, baseStock + variance);
      const medId = insertMed.run(centreId, name, unit, stock, reorder).lastInsertRowid;

      let runningStock = stock + 40;
      for (let d = 14; d >= 0; d--) {
        const consumed = Math.floor(Math.random() * 6) + 1;
        runningStock = Math.max(0, runningStock - consumed);
        insertStockHist.run(medId, dateStr(d), runningStock, consumed);
      }
    });
  });

  const insertFootfall = db.prepare(
    'INSERT INTO footfall (centre_id, date, patient_count) VALUES (?,?,?)'
  );
  centreIds.forEach((centreId, ci) => {
    for (let d = 14; d >= 0; d--) {
      const base = 20 + ci * 5;
      const count = base + Math.floor(Math.random() * 15);
      insertFootfall.run(centreId, dateStr(d), count);
    }
  });

  const insertBeds = db.prepare(
    'INSERT INTO beds (centre_id, date, occupied_beds) VALUES (?,?,?)'
  );
  centres.forEach(([, , , totalBeds], ci) => {
    const centreId = centreIds[ci];
    for (let d = 3; d >= 0; d--) {
      const occ = Math.floor(Math.random() * (totalBeds + 1));
      insertBeds.run(centreId, dateStr(d), occ);
    }
  });

  const doctorNames = ['Dr. Kumar', 'Dr. Priya', 'Dr. Suresh'];
  const insertDoctor = db.prepare(
    'INSERT INTO doctors (centre_id, name, specialization) VALUES (?,?,?)'
  );
  const insertAttendance = db.prepare(
    'INSERT INTO doctor_attendance (doctor_id, date, present) VALUES (?,?,?)'
  );
  centreIds.forEach((centreId, ci) => {
    const numDocs = ci % 2 === 0 ? 1 : 2;
    for (let i = 0; i < numDocs; i++) {
      const docId = insertDoctor
        .run(centreId, doctorNames[(ci + i) % doctorNames.length], 'General Medicine')
        .lastInsertRowid;
      for (let d = 6; d >= 0; d--) {
        const absenceChance = ci === 3 ? 0.5 : 0.15;
        const present = Math.random() > absenceChance ? 1 : 0;
        insertAttendance.run(docId, dateStr(d), present);
      }
    }
  });

  const testNames = ['Blood Sugar', 'Malaria', 'TB Sputum', 'Pregnancy Test', 'HIV Rapid Test'];
  const insertTest = db.prepare(
    'INSERT INTO tests (centre_id, test_name, available, last_audit_date) VALUES (?,?,?,?)'
  );
  centreIds.forEach((centreId, ci) => {
    testNames.forEach((tn, ti) => {
      const available = !(ci === 2 && ti === 3) && !(ci === 4 && ti === 4) ? 1 : 0;
      insertTest.run(centreId, tn, available, dateStr(1));
    });
  });

  console.log('Seeding complete.');
}

module.exports = db;