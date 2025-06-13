// verificationRoutes.js – Picker registration, QR generation & verification API
// Ross, this is the full Express router that completes the endpoints you drafted. 
// It now includes:
//   • forwarder / picker registration with HKID upload & on‑the‑fly QR‑code generation
//   • static serving for the QR images
//   • route‑order fix (specific routes first to avoid shadowing)
//   • helper utilities & stricter validation
//   • comments that map each block to the DB tables you already created
// ───────────────────────────────────────────────────────────────────────────────

const express  = require("express");
const router   = express.Router();
const mysql    = require("mysql2/promise");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const QRCode   = require("qrcode");

// Ensure required folders exist at runtime (avoids ENOENT)
["uploads/hkid", "public/qrcodes"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ───────────────────────────────────────────────────────── Connection pool ───┐
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || "localhost",
  user:             process.env.DB_USER     || "root",
  password:         process.env.DB_PASSWORD || "",
  database:         process.env.DB_NAME     || "warehouse_picker_system",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  acquireTimeout:     60_000,
  timeout:            60_000
});
// ──────────────────────────────────────────────────────────────────────────────┘

// ──────────────────────────────── Basic / fallback logger ────────────────────
let logger;
try { logger = require("../utils/logger"); }
catch { logger = { info: console.log, error: console.error, warn: console.warn }; }
// ──────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────── Upload handler for HKID ──────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/hkid"),
  filename:    (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
// ──────────────────────────────────────────────────────────────────────────────

// Helper: create deterministic‑enough unique QR id, e.g. WH20250613095045123X
function generateQrId () {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, ""); // yyyymmddhhmmssmmm
  const extra = Math.random().toString(36).slice(-2).toUpperCase();
  return "WH" + ts + extra;  // always starts with WH, good for identifier logic
}

// Helper: produce a PNG QR code file & return its public URL path
async function createQrPng (qrId) {
  const pngPath = path.join("public/qrcodes", `${qrId}.png`);
  await QRCode.toFile(pngPath, qrId, { errorCorrectionLevel: "H", type: "png", margin: 3 });
  return `/qrcodes/${qrId}.png`; // path served by express.static
}

// ────────────────────────────────────────────── Health‑check ──────────────────
router.get("/ping", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─────────────────────────────────────────── Ⅰ. Picker registration ──────────
// @route  POST /api/verification/register
// @desc   Forwarder registers a picker & obtains the QR code link
// Fields (multipart/form‑data):
//   forwarderName*  piNumber*  pickerName*  pickerContact*  hkidNumber*  carPlate  
//   hkidImage(file) – optional upload
router.post("/register", upload.single("hkidImage"), async (req, res) => {
  const {
    forwarderName, piNumber, pickerName,
    pickerContact, hkidNumber, carPlate = null
  } = req.body;

  if (!forwarderName || !piNumber || !pickerName || !pickerContact || !hkidNumber) {
    return res.status(400).json({ success:false, message:"Missing mandatory fields" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1️⃣ ensure PI exists in shipping_orders (optional based on DB design)
    const [[order]] = await connection.query(
      "SELECT pi_number FROM shipping_orders WHERE pi_number = ? FOR UPDATE",
      [piNumber]
    );

    if (!order) {
      await connection.execute(
        `INSERT INTO shipping_orders (pi_number, picking_status, created_time)
         VALUES (?, 'pending', NOW())`, [piNumber]
      );
    }

    // 2️⃣ create picker record
    const qrId   = generateQrId();
    const qrUrl  = await createQrPng(qrId);
    const hkidPath = req.file ? req.file.path : null;

    await connection.execute(`
      INSERT INTO pickers (
        qr_code_id, forwarder_name, pi_number, picker_name,
        picker_contact, hkid_number, car_plate_number,
        registration_time, status, hkid_image_path
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        qrId, forwarderName, piNumber, pickerName,
        pickerContact, hkidNumber, carPlate,
        new Date(), "pending", hkidPath
    ]);

    await connection.commit();
    logger.info("Picker registered", { piNumber, qrId });

    return res.status(201).json({
      success: true,
      message: "Picker registered successfully – share the QR code with the driver.",
      data: {
        qrCodeId:   qrId,
        qrCodeUrl:  qrUrl,
        piNumber:   piNumber,
        registrationTime: new Date().toISOString()
      }
    });
  } catch (err) {
    await connection.rollback();
    logger.error("Picker registration failed", err);
    return res.status(500).json({ success:false, message:"Registration failed", error: err.message });
  } finally {
    connection.release();
  }
});

// Static serving for QR code PNGs (mounts below /api/verification, safe) --------
router.use("/qrcodes", express.static(path.resolve("public/qrcodes")));

// ──────────────────────────────── Ⅱ. Verification history & logs ─────────────
// ⚠️ Note: specific routes first to prevent shadow‑match by /:identifier later.
// @route GET /history/:piNumber      @route GET /logs/recent
router.get("/history/:piNumber", async (req, res) => {
  try {
    const { piNumber } = req.params;
    const [rows] = await pool.execute(`
      SELECT vl.*, p.picker_name, p.forwarder_name
      FROM verification_logs vl
      LEFT JOIN pickers p ON vl.qr_code_id = p.qr_code_id
      WHERE vl.pi_number = ?
      ORDER BY vl.verification_time DESC`, [piNumber]);
    return res.json({ success:true, data:{ piNumber, verificationHistory: rows } });
  } catch (e) {
    logger.error("History fetch err", e);
    res.status(500).json({ success:false, message:"Unable to fetch history" });
  }
});

router.get("/logs/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const [rows] = await pool.execute(`
      SELECT vl.*, p.picker_name, p.forwarder_name
      FROM verification_logs vl
      LEFT JOIN pickers p ON vl.qr_code_id = p.qr_code_id
      ORDER BY vl.verification_time DESC LIMIT ?`, [limit]);
    return res.json({ success:true, data:{ logs: rows } });
  } catch (e) {
    logger.error("Recent logs err", e);
    res.status(500).json({ success:false, message:"Unable to fetch logs" });
  }
});

// ───────────────────────────────────── Ⅲ. Pickup confirmation ─────────────────
router.post("/confirm", async (req, res) => {
  const { qrCodeId, piNumber, gateOperator, notes } = req.body;
  if (!qrCodeId && !piNumber) {
    return res.status(400).json({ success:false, message:"qrCodeId or piNumber required" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Resolve PI and QR relationship
    let targetPi = piNumber, targetQR = qrCodeId;
    if (!targetPi) {
      const [[row]] = await connection.execute("SELECT pi_number FROM pickers WHERE qr_code_id = ?", [qrCodeId]);
      if (!row) throw new Error("Picker not found for QR code");
      targetPi = row.pi_number;
    }
    if (!targetQR) {
      const [[row]] = await connection.execute("SELECT qr_code_id FROM pickers WHERE pi_number = ?", [piNumber]);
      targetQR = row ? row.qr_code_id : null;
    }

    // 1️⃣ mark shipping order complete (ignore if not present)
    await connection.execute(`
      UPDATE shipping_orders SET picking_status='completed', picking_time=NOW()
      WHERE pi_number=?`, [targetPi]);

    // 2️⃣ mark picker verified
    await connection.execute(`
      UPDATE pickers SET status='verified', verification_time=NOW()
      WHERE qr_code_id=?`, [targetQR]);

    // 3️⃣ log it
    await connection.execute(`
      INSERT INTO verification_logs (qr_code_id, pi_number, verification_time,
        gate_operator, verification_status, notes)
      VALUES (?,?,NOW(),?, 'approved', ?)`, [
        targetQR, targetPi, gateOperator || "Gate", notes || "Pickup confirmed"
    ]);

    await connection.commit();
    return res.json({ success:true, message:"Pickup confirmed", data:{ piNumber:targetPi, qrCodeId:targetQR } });
  } catch (e) {
    await connection.rollback();
    logger.error("Confirm pickup err", e);
    res.status(500).json({ success:false, message:e.message });
  } finally {
    connection.release();
  }
});

// ───────────────────────────────────── Ⅳ. Access denial ──────────────────────
router.post("/deny", async (req, res) => {
  const { qrCodeId, piNumber, gateOperator, reason } = req.body;
  if (!reason || (!qrCodeId && !piNumber)) {
    return res.status(400).json({ success:false, message:"reason & qrCodeId/piNumber required" });
  }
  let targetPi = piNumber, targetQR = qrCodeId;
  if (!targetPi && qrCodeId) {
    const [[row]] = await pool.execute("SELECT pi_number FROM pickers WHERE qr_code_id=?", [qrCodeId]);
    targetPi = row ? row.pi_number : null;
  }
  if (!targetQR && piNumber) {
    const [[row]] = await pool.execute("SELECT qr_code_id FROM pickers WHERE pi_number=?", [piNumber]);
    targetQR = row ? row.qr_code_id : null;
  }
  await pool.execute(`
    INSERT INTO verification_logs (qr_code_id, pi_number, verification_time,
      gate_operator, verification_status, notes)
    VALUES (?,?,NOW(),?, 'denied', ?)`, [
      targetQR || "UNKNOWN", targetPi || "UNKNOWN", gateOperator || "Gate", `Denied: ${reason}`
  ]);
  return res.json({ success:true, message:"Denial logged" });
});

// ───────────────────────────────────── Ⅴ. Verification lookup ────────────────
// ⚠️ Keep this LAST to avoid swallowing the more specific paths above!
router.get("/:identifier", async (req, res) => {
  const { identifier } = req.params;
  const connection = await pool.getConnection();
  try {
    const isQRCode = identifier.startsWith("WH") && identifier.length > 10;
    let piNumber = identifier;
    if (isQRCode) {
      const [[row]] = await connection.execute("SELECT pi_number FROM pickers WHERE qr_code_id=?", [identifier]);
      if (!row) return res.status(404).json({ success:false, message:"Invalid QR code" });
      piNumber = row.pi_number;
    }

    const [rows] = await connection.execute(`
      SELECT p.*, s.* FROM pickers p
      LEFT JOIN shipping_orders s ON p.pi_number = s.pi_number
      WHERE p.pi_number = ?`, [piNumber]);
    if (!rows.length) return res.status(404).json({ success:false, message:"Picker not found" });

    const picker = rows[0];
    const regTime   = new Date(picker.registration_time);
    const expiry    = new Date(regTime.getTime() + 24*60*60*1000);
    const isExpired = Date.now() > expiry.getTime();
    if (isExpired && picker.status !== "expired") {
      await connection.execute("UPDATE pickers SET status='expired' WHERE qr_code_id=?", [picker.qr_code_id]);
    }
    // Log attempt (async – fire and forget)
    connection.execute(`INSERT INTO verification_logs (qr_code_id,pi_number,verification_time,verification_status,notes)
      VALUES (?,?,NOW(),?,?)`, [picker.qr_code_id, picker.pi_number, isExpired?"denied":"approved", isExpired?"expired":"ok"]);

    return res.status(isExpired?410:200).json({
      success: !isExpired,
      message: isExpired ? "QR expired" : "Picker verified",
      data: {
        picker: {
          pickerId: picker.picker_id,
          pickerName: picker.picker_name,
          forwarderName: picker.forwarder_name,
          piNumber: picker.pi_number,
          pickerContact: picker.picker_contact,
          hkidNumber: picker.hkid_number,
          carPlate: picker.car_plate_number,
          qrCodeId: picker.qr_code_id,
          registrationTime: picker.registration_time,
          status: isExpired?"expired":picker.status
        },
        shippingOrder: picker.parts_number ? {
          partsNumber: picker.parts_number,
          serialNumber: picker.serial_number,
          weightKg: picker.weight_kg,
          dimensions: { length: picker.length_cm, width: picker.width_cm, height: picker.height_cm },
          pickingStatus: picker.picking_status,
          pickingTime: picker.picking_time
        } : null,
        verification: {
          verificationTime: new Date().toISOString(),
          expiryTime: expiry.toISOString(),
          isExpired
        }
      }
    });
  } catch (e) {
    logger.error("Verify err", e);
    res.status(500).json({ success:false, message:"Verification failed" });
  } finally {
    connection.release();
  }
});

// ──────────────────────────────────────────────────────────────────────────────
module.exports = router;
