import { areJidsSameUser } from '@whiskeysockets/baileys';
import fs from 'fs';

const DATABASE_FILE = './database.json';

const BIENVENIDA_DEFAULT =
  '╭─〔 🫧 BIENVENIDO/A 〕─╮\n\n' +
  '👤 @user\n' +
  '🫧 Bienvenido/a a @grupo\n\n' +
  '👥 Miembros: @total\n\n' +
  '📜 @desc\n\n' +
  '╰────────────────╯';

const DESPEDIDA_DEFAULT =
  '╭─〔 🫧 DESPEDIDA 〕─╮\n\n' +
  '👤 @user\n' +
  'ha salido de @grupo.\n\n' +
  '👥 Miembros restantes: @total\n\n' +
  '╰────────────────╯';


/* ============================================================
 * BASE DE DATOS
 * ============================================================ */

function cargarDatabase() {
  try {
    if (!fs.existsSync(DATABASE_FILE)) {
      return {};
    }

    const contenido =
      fs.readFileSync(
        DATABASE_FILE,
        'utf8'
      );

    if (!contenido.trim()) {
      return {};
    }

    return JSON.parse(contenido);

  } catch (error) {

    console.error(
      '[WELCOME] Error leyendo database.json:',
      error
    );

    return {};
  }
}


function guardarDatabase(database) {
  fs.writeFileSync(
    DATABASE_FILE,
    JSON.stringify(
      database,
      null,
      2
    )
  );
}


/* ============================================================
 * CONFIGURACIÓN DEL GRUPO
 * ============================================================ */

function obtenerConfig(chatId) {

  const database =
    cargarDatabase();

  if (!database.welcome) {
    database.welcome = {};
  }

  if (!database.welcome[chatId]) {

    database.welcome[chatId] = {
      enabled: true,
      welcomeMessage: BIENVENIDA_DEFAULT,
      byeMessage: DESPEDIDA_DEFAULT
    };

    guardarDatabase(database);
  }

  return {
    database,
    config: database.welcome[chatId]
  };
}


/* ============================================================
 * REEMPLAZAR VARIABLES
 * ============================================================ */

function prepararMensaje(
  texto,
  usuario,
  metadata
) {

  const grupo =
    metadata?.subject ||
    'este grupo';

  const total =
    metadata?.participants?.length ||
    0;

  const desc =
    metadata?.desc ||
    'Sin descripción';

  return texto
    .replace(
      /@user/g,
      `@${usuario.split('@')[0]}`
    )
    .replace(
      /@grupo/g,
      grupo
    )
    .replace(
      /@total/g,
      String(total)
    )
    .replace(
      /@desc/g,
      desc
    );
}


/* ============================================================
 * OBTENER CUERPO ORIGINAL
 * ============================================================ */

function obtenerTexto(msg, context) {

  if (context?.body) {
    return context.body.trim();
  }

  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    ''
  ).trim();
}


/* ============================================================
 * CREAR PLUGIN
 * ============================================================ */

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


  run: async (
    sock,
    msg,
    args,
    context
  ) => {

    const {
      chatId
    } = context;


    /* ========================================================
     * SOLO GRUPOS
     * ======================================================== */

    if (!chatId?.endsWith('@g.us')) {

      return sock.sendMessage(
        chatId,
        {
          text:
            '🫧 Este comando solo puede usarse en grupos.'
        },
        {
          quoted: msg
        }
      );
    }


    try {

      /* ======================================================
       * OBTENER METADATA
       * ====================================================== */

      const metadata =
        await sock.groupMetadata(
          chatId
        );

      const participants =
        metadata.participants || [];


      /* ======================================================
       * IDENTIFICAR USUARIO
       * ====================================================== */

      const senderId =
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid;


      const sender =
        participants.find(
          p =>
            p.id &&
            senderId &&
            areJidsSameUser(
              p.id,
              senderId
            )
        );


      /* ======================================================
       * VERIFICAR ADMIN
       * ====================================================== */

      if (
        !sender ||
        ![
          'admin',
          'superadmin'
        ].includes(sender.admin)
      ) {

        return sock.sendMessage(
          chatId,
          {
            text:
              '❌ Solo los administradores pueden configurar las bienvenidas.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * OBTENER CONFIGURACIÓN
       * ====================================================== */

      const {
        database,
        config
      } =
        obtenerConfig(
          chatId
        );


      /* ======================================================
       * IDENTIFICAR COMANDO REAL
       * ====================================================== */

      const texto =
        obtenerTexto(
          msg,
          context
        );


      const partes =
        texto.split(/\s+/);

      const comando =
        (partes[0] || '')
          .replace(
            /^\./,
            ''
          )
          .toLowerCase();


      const mensaje =
        partes
          .slice(1)
          .join(' ')
          .trim();


      /* ======================================================
       * .WELCOME ON
       * ====================================================== */

      if (
        comando === 'welcome' &&
        mensaje.toLowerCase() === 'on'
      ) {

        config.enabled =
          true;

        guardarDatabase(
          database
        );

        return sock.sendMessage(
          chatId,
          {
            text:
              '🫧 *BIENVENIDAS ACTIVADAS*\n\n' +
              '✅ El sistema de bienvenida está activado.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .WELCOME OFF
       * ====================================================== */

      if (
        comando === 'welcome' &&
        mensaje.toLowerCase() === 'off'
      ) {

        config.enabled =
          false;

        guardarDatabase(
          database
        );

        return sock.sendMessage(
          chatId,
          {
            text:
              '🫧 *BIENVENIDAS DESACTIVADAS*\n\n' +
              '❌ El sistema de bienvenida está desactivado.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .WELCOME
       * ====================================================== */

      if (
        comando === 'welcome'
      ) {

        return sock.sendMessage(
          chatId,
          {
            text:
              'ꕥ *CONFIGURACIÓN DE BIENVENIDAS*\n\n' +
              'Usa:\n\n' +
              '♡ .welcome on\n' +
              '♡ .welcome off\n' +
              '♡ .setwelcome <mensaje>\n' +
              '♡ .setbye <mensaje>\n' +
              '♡ .resetwelcome\n' +
              '♡ .resetbye\n' +
              '♡ .verwelcome'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .SETWELCOME
       * ====================================================== */

      if (
        comando === 'setwelcome'
      ) {

        if (!mensaje) {

          return sock.sendMessage(
            chatId,
            {
              text:
                '❌ Debes escribir el mensaje.\n\n' +
                'Ejemplo:\n' +
                '.setwelcome 🫧 Bienvenido @user a @grupo'
            },
            {
              quoted: msg
            }
          );
        }


        config.welcomeMessage =
          mensaje;

        guardarDatabase(
          database
        );


        return sock.sendMessage(
          chatId,
          {
            text:
              '✅ *BIENVENIDA ACTUALIZADA*\n\n' +
              'El nuevo mensaje de bienvenida fue guardado correctamente.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .SETBYE
       * ====================================================== */

      if (
        comando === 'setbye'
      ) {

        if (!mensaje) {

          return sock.sendMessage(
            chatId,
            {
              text:
                '❌ Debes escribir el mensaje.\n\n' +
                'Ejemplo:\n' +
                '.setbye 👋 @user salió de @grupo'
            },
            {
              quoted: msg
            }
          );
        }


        config.byeMessage =
          mensaje;

        guardarDatabase(
          database
        );


        return sock.sendMessage(
          chatId,
          {
            text:
              '✅ *DESPEDIDA ACTUALIZADA*\n\n' +
              'El nuevo mensaje de despedida fue guardado correctamente.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .RESETWELCOME
       * ====================================================== */

      if (
        comando === 'resetwelcome'
      ) {

        config.welcomeMessage =
          BIENVENIDA_DEFAULT;

        guardarDatabase(
          database
        );


        return sock.sendMessage(
          chatId,
          {
            text:
              '♻️ Mensaje de bienvenida restaurado correctamente.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .RESETBYE
       * ====================================================== */

      if (
        comando === 'resetbye'
      ) {

        config.byeMessage =
          DESPEDIDA_DEFAULT;

        guardarDatabase(
          database
        );


        return sock.sendMessage(
          chatId,
          {
            text:
              '♻️ Mensaje de despedida restaurado correctamente.'
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * .VERWELCOME
       * ====================================================== */

      if (
        comando === 'verwelcome'
      ) {

        return sock.sendMessage(
          chatId,
          {
            text:

              `ꕥ *CONFIGURACIÓN DE BIENVENIDAS*\n\n` +

              `〄 *Estado actual:*\n` +

              `> Bienvenidas: *${
                config.enabled
                  ? 'Activado'
                  : 'Desactivado'
              }*\n\n` +

              `> *Mensaje de bienvenida:*\n` +
              `${config.welcomeMessage}\n\n` +

              `> *Mensaje de despedida:*\n` +
              `${config.byeMessage}\n\n` +

              `✐ *Comandos disponibles:*\n\n` +

              `> *.welcome on* — Activar\n` +
              `> *.welcome off* — Desactivar\n` +
              `> *.setwelcome <mensaje>*\n` +
              `> *.setbye <mensaje>*\n` +
              `> *.resetwelcome*\n` +
              `> *.resetbye*\n` +
              `> *.verwelcome*\n\n` +

              `〄 *Variables disponibles:*\n` +
              `> *@user* — Usuario\n` +
              `> *@grupo* — Nombre del grupo\n` +
              `> *@total* — Miembros\n` +
              `> *@desc* — Descripción`
          },
          {
            quoted: msg
          }
        );
      }


      /* ======================================================
       * COMANDO NO RECONOCIDO
       * ====================================================== */

      return sock.sendMessage(
        chatId,
        {
          text:
            '❌ Comando de bienvenida no reconocido.\n\n' +
            'Usa *.verwelcome* para ver los comandos disponibles.'
        },
        {
          quoted: msg
        }
      );


    } catch (error) {

      console.error(
        '[WELCOME ERROR]',
        error
      );


      return sock.sendMessage(
        chatId,
        {
          text:
            '❌ Ocurrió un error al configurar las bienvenidas.\n\n' +
            `> ${error?.message || error}`
        },
        {
          quoted: msg
        }
      );
    }
  }
};