const admin = require('firebase-admin');

let initialized = false;

const initFirebase = () => {
  if (initialized) return;

  const credentialsBase64 = process.env.FIREBASE_CREDENTIALS_BASE64;
  if (!credentialsBase64) {
    console.warn('[!] FIREBASE_CREDENTIALS_BASE64 no definido — push notifications desactivadas');
    return;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(credentialsBase64, 'base64').toString('utf8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    initialized = true;
    console.log('✔ Firebase Admin SDK inicializado');
  } catch (err) {
    console.error('[!] Error inicializando Firebase Admin SDK:', err.message);
  }
};

// Envía push a una lista de tokens FCM.
// Elimina automáticamente tokens inválidos y retorna los que fallaron.
const sendPush = async (tokens, { title, body, data = {} }) => {
  if (!initialized || tokens.length === 0) return { invalidTokens: [] };

  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const messages = tokens.map((token) => ({
    token,
    notification: { title, body },
    data: stringData,
    webpush: {
      notification: { title, body, icon: '/icon.png' },
      fcm_options: { link: '/' },
    },
  }));

  try {
    const response = await admin.messaging().sendEach(messages);
    const invalidTokens = [];

    response.responses.forEach((res, i) => {
      if (!res.success) {
        const code = res.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[i]);
        }
        console.warn(`[!] FCM error para token ${i}:`, res.error?.message);
      }
    });

    console.log(` [v] FCM: ${response.successCount}/${tokens.length} enviados`);
    return { invalidTokens };
  } catch (err) {
    console.error('[!] Error enviando FCM batch:', err.message);
    return { invalidTokens: [] };
  }
};

module.exports = { initFirebase, sendPush };
