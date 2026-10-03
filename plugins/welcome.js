import fs from 'fs';
import path from 'path';
import { areJidsSameUser } from '@whiskeysockets/baileys';

const DB_FILE = path.join(process.cwd(), 'welcome.json');

const DEFAULT_CONFIG = {
  enabled: false,
  welcome: '👋 Hola @user, bienvenid@ a @grupo.',
  bye: '👋 @user salió de @grupo.'
};

function cargarDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, '{}');
      return {};
    }

    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function guardarDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

function obtenerConfig(chatId) {
  const db = cargarDB();

  if (!db[chatId]) {
    db[chatId] = { ...DEFAULT_CONFIG };
    guardarDB(db);
  }

  return db[chatId];
}

function reemplazarVariables(texto, user, metadata) {
  return texto
    .replace(/@user/g, `@${user.split('@')[0]}`)
    .replace(/@grupo/g, metadata.subject || 'este grupo')
    .replace(/@total/g, String(metadata.participants?.length || 0))
    .replace(/@desc/g, metadata.desc || 'Sin descripción');
}

export async function enviarWelcome(sock, update) {
  try {
    const chatId = update.id;

    if (!chatId?.endsWith('@g.us')) return;

    const config = obtenerConfig(chatId);

    if (!config.enabled) return;

    const metadata = await sock.groupMetadata(chatId);

    for (const participante of update.participants || []) {
      const texto = reemplazarVariables(
        config.welcome,
        participante,
        metadata
      );

      await sock.sendMessage(chatId, {
        text: texto,
        mentions: [participante]
      });
    }

  } catch (error) {
    console.error(
      '[WELCOME ERROR]',
      error?.stack || error
    );
  }
}

export async function enviarBye(sock, update) {
  try {
    const chatId = update.id;

    if (!chatId?.endsWith('@g.us')) return;

    const config = obtenerConfig(chatId);

    if (!config.enabled) return;

    const metadata = await sock.groupMetadata(chatId);

    for (const participante of update.participants || []) {
      const texto = reemplazarVariables(
        config.bye,
        participante,
        metadata
      );

      await sock.sendMessage(chatId, {
        text: texto,
        mentions: [participante]
      });
    }

  } catch (error) {
    console.error(
      '[BYE ERROR]',
      error?.stack || error
    );
  }
}

export default {
  command: [
    'welcome',
    'setwelcome',
    'setbye',
    'resetwelcome',
    'resetbye',
    'verwelcome'
  ],

  category: 'group',

  description:
    'Configura las bienvenidas y despedidas del grupo',

  run: async (sock, msg, args, context) => {

    const { chatId } = context;

    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '🫧 Este comando solo puede usarse en grupos.'
      }, { quoted: msg });
    }

    try {

      const metadata =
        await sock.groupMetadata(chatId);

      const participantes =
        metadata.participants || [];

      const senderId =
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid;

      const sender =
        participantes.find(p =>
          p.id &&
          senderId &&
          areJidsSameUser(p.id, senderId)
        );

      if (
        !sender ||
        !['admin', 'superadmin'].includes(sender.admin)
      ) {
        return sock.sendMessage(chatId, {
          text:
            '❌ Solo los administradores pueden configurar las bienvenidas.'
        }, { quoted: msg });
      }

      const db = cargarDB();

      if (!db[chatId]) {
        db[chatId] = { ...DEFAULT_CONFIG };
      }

      const config = db[chatId];

      /*
       * IMPORTANTE:
       * El primer elemento de args corresponde al argumento
       * después del comando.
       */

      const command =
        (args?.[0] || '').toLowerCase();

      const message =
        args?.slice(1).join(' ').trim();

      /*
       * .welcome on
       */
      if (command === 'on') {

        config.enabled = true;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '🫧 *BIENVENIDAS ACTIVADAS*\n\n' +
            '✅ El sistema de bienvenida y despedida está activado.'
        }, { quoted: msg });
      }

      /*
       * .welcome off
       */
      if (command === 'off') {

        config.enabled = false;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '🫧 *BIENVENIDAS DESACTIVADAS*\n\n' +
            '❌ El sistema de bienvenida y despedida está desactivado.'
        }, { quoted: msg });
      }

      /*
       * .setwelcome
       */
      if (command === 'setwelcome') {

        if (!message) {
          return sock.sendMessage(chatId, {
            text:
              '❌ Escribe el mensaje.\n\n' +
              'Ejemplo:\n' +
              '.setwelcome 👋 Hola @user, bienvenid@ a @grupo'
          }, { quoted: msg });
        }

        config.welcome = message;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '✅ *BIENVENIDA ACTUALIZADA*\n\n' +
            'El nuevo mensaje fue guardado correctamente.'
        }, { quoted: msg });
      }

      /*
       * .setbye
       */
      if (command === 'setbye') {

        if (!message) {
          return sock.sendMessage(chatId, {
            text:
              '❌ Escribe el mensaje.\n\n' +
              'Ejemplo:\n' +
              '.setbye 👋 @user salió de @grupo'
          }, { quoted: msg });
        }

        config.bye = message;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '✅ *DESPEDIDA ACTUALIZADA*\n\n' +
            'El nuevo mensaje fue guardado correctamente.'
        }, { quoted: msg });
      }

      /*
       * .resetwelcome
       */
      if (command === 'resetwelcome') {

        config.welcome =
          DEFAULT_CONFIG.welcome;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '♻️ Mensaje de bienvenida restaurado correctamente.'
        }, { quoted: msg });
      }

      /*
       * .resetbye
       */
      if (command === 'resetbye') {

        config.bye =
          DEFAULT_CONFIG.bye;

        db[chatId] = config;
        guardarDB(db);

        return sock.sendMessage(chatId, {
          text:
            '♻️ Mensaje de despedida restaurado correctamente.'
        }, { quoted: msg });
      }

      /*
       * .verwelcome
       */
      if (command === 'verwelcome') {

        return sock.sendMessage(chatId, {
          text:
            `ꕥ *CONFIGURACIÓN DE BIENVENIDAS*\n\n` +
            `〄 Estado: *${config.enabled ? 'Activado' : 'Desactivado'}*\n\n` +
            `👋 *Bienvenida:*\n${config.welcome}\n\n` +
            `👋 *Despedida:*\n${config.bye}\n\n` +
            `✐ *Variables:*\n` +
            `> @user — Usuario\n` +
            `> @grupo — Nombre del grupo\n` +
            `> @total — Miembros\n` +
            `> @desc — Descripción`
        }, { quoted: msg });
      }

      return sock.sendMessage(chatId, {
        text:
          `ꕥ *CONFIGURACIÓN DE BIENVENIDAS*\n\n` +
          `Usa:\n\n` +
          `• .welcome on\n` +
          `• .welcome off\n` +
          `• .setwelcome <mensaje>\n` +
          `• .setbye <mensaje>\n` +
          `• .resetwelcome\n` +
          `• .resetbye\n` +
          `• .verwelcome`
      }, { quoted: msg });

    } catch (error) {

      console.error(
        '[WELCOME ERROR]',
        error?.stack || error
      );

      return sock.sendMessage(chatId, {
        text:
          `❌ Error:\n${error?.message || error}`
      }, { quoted: msg });
    }
  }
};