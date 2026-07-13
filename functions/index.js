/* دالة Firebase Cloud Function: التحقق من كود التفعيل وتتبع الأجهزة (حد 3 أجهزة لكل كود)
   - تُستدعى عبر المسار /api/activate (مربوط بها من firebase.json)
   - تستخدم نفس مشروع Firestore الموجود أصلاً في اللعبة (لا حاجة لمشروع منفصل)
   - كل كود يُخزَّن كمستند في مجموعة activationDevices، وبداخله قائمة الأجهزة المسجّلة له */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const MAX_DEVICES = 3;

/* الأكواد الصالحة (نفس أكواد codes.json) */
const EMBEDDED_CODES=[
  'TH-23M2-5FQD',
  'TH-26G8-C4QG',
  'TH-2ZNY-GRS2',
  'TH-47MY-XQVY',
  'TH-4UKA-DM7T',
  'TH-66VM-BWWR',
  'TH-6BD3-Y4G2',
  'TH-6GRY-QC9D',
  'TH-6NKK-4NNE',
  'TH-6NMD-ZMHY',
  'TH-7KWA-46JV',
  'TH-7MMR-WQ4X',
  'TH-7X4M-EUG5',
  'TH-89C5-FBP5',
  'TH-8CVP-FQZU',
  'TH-8UK2-KZ22',
  'TH-8Y2K-Z3D4',
  'TH-99KM-6UJC',
  'TH-9B2W-C4ZW',
  'TH-9W3N-UHM9',
  'TH-A3WM-4PVY',
  'TH-ACU6-U7JF',
  'TH-B8X4-ZH2F',
  'TH-BBAX-67BE',
  'TH-BJW4-33SV',
  'TH-C32C-VQ5X',
  'TH-C3FV-WBV2',
  'TH-D7J5-PHSC',
  'TH-DC7X-V7RM',
  'TH-DHHN-WDQF',
  'TH-DVS2-FF3X',
  'TH-E86F-822F',
  'TH-EMMM-Q4PK',
  'TH-FAU4-HXHK',
  'TH-FBCB-YR97',
  'TH-FD3Q-HRDT',
  'TH-FDRP-9BWF',
  'TH-G4K2-9Z6U',
  'TH-GBT5-57QN',
  'TH-GCZM-BENW',
  'TH-GYKB-Z9C6',
  'TH-GYRQ-36GC',
  'TH-H6VP-MW78',
  'TH-HCM6-D3K7',
  'TH-HHXT-6CQM',
  'TH-HJ9D-Q9PQ',
  'TH-JC9S-MJTU',
  'TH-JRZ9-AHX9',
  'TH-JUHJ-79EK',
  'TH-K7K2-W4EZ',
  'TH-KHGY-VUUQ',
  'TH-KKMD-68W3',
  'TH-KPK5-ZNFV',
  'TH-KT25-PTGM',
  'TH-KVBQ-65JZ',
  'TH-M3TS-S5R5',
  'TH-M8PS-7TS3',
  'TH-MAYQ-YE5T',
  'TH-N9QK-HJ8Z',
  'TH-NEG9-EAYM',
  'TH-NJFX-8F5A',
  'TH-NJQU-TTY6',
  'TH-NJRD-3B5Z',
  'TH-NT3Q-3CMJ',
  'TH-NW8P-5Y5E',
  'TH-PFHS-7HFC',
  'TH-PFKK-Z4PD',
  'TH-PGBM-3RB8',
  'TH-PJM6-CBVH',
  'TH-PQC6-6E7Z',
  'TH-QFSK-W8GF',
  'TH-QM9J-RS64',
  'TH-QPVG-FF7Q',
  'TH-R3GV-D2ZR',
  'TH-RNJW-VENJ',
  'TH-RRTD-3769',
  'TH-S26J-KFMT',
  'TH-T8HN-553N',
  'TH-T8XF-7GD5',
  'TH-THJ7-WH2X',
  'TH-TJBN-7MV9',
  'TH-TNGA-CARM',
  'TH-TXC5-3T55',
  'TH-UE82-8G3K',
  'TH-V3DC-QSQF',
  'TH-VTK8-4RGJ',
  'TH-VYRY-KZFH',
  'TH-WED5-BD3P',
  'TH-WGD5-NDW7',
  'TH-WZAR-FDWM',
  'TH-X5R6-7UUN',
  'TH-XA5E-45EC',
  'TH-XSZB-3HGM',
  'TH-YDRP-4U2K',
  'TH-YJMN-46BF',
  'TH-YQU7-8JEK',
  'TH-YSJ4-34WH',
  'TH-Z5XZ-MBUT',
  'TH-ZM5K-S47E',
  'TH-ZMGP-V4ZY'
];

function sendJson(res, statusCode, obj){
  res.status(statusCode).set('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(obj));
}

exports.activate = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST'){
    return sendJson(res, 405, { success:false, message:'طريقة غير مسموحة' });
  }

  const body = req.body || {};
  const code = String(body.code || '').toUpperCase().trim();
  const deviceId = String(body.deviceId || '').trim();

  if (!/^TH-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || !deviceId){
    return sendJson(res, 400, { success:false, message:'الكود أو معرف الجهاز غير صالح' });
  }

  if (EMBEDDED_CODES.indexOf(code) === -1){
    return sendJson(res, 200, { success:false, message:'الكود غير صحيح' });
  }

  const ref = db.collection('activationDevices').doc(code);

  try{
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      let devices = [];
      if (snap.exists){
        const data = snap.data();
        devices = Array.isArray(data.devices) ? data.devices : [];
      }

      if (devices.indexOf(deviceId) !== -1){
        /* جهاز مسجّل مسبقاً على هذا الكود */
        return { success:true, message:'تم التحقق ✓' };
      }

      if (devices.length >= MAX_DEVICES){
        return { success:false, message:'الكود مستخدم على ' + MAX_DEVICES + ' أجهزة' };
      }

      devices.push(deviceId);
      t.set(ref, {
        devices: devices,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      return { success:true, message:'تم التفعيل ✓' };
    });

    return sendJson(res, 200, result);
  }catch(e){
    console.error(e);
    return sendJson(res, 500, { success:false, message:'خطأ في السيرفر، حاول لاحقاً' });
  }
});
