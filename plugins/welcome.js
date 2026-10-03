import { areJidsSameUser } from '@whiskeysockets/baileys';

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
  description: 'Configura las bienvenidas y despedidas del grupo',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    // =========================
    // SOLO GRUPOS
    // =========================
    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(
        chatId,
        {
          text: '🫧 Este comando solo puede usarse en grupos.'
        },
        { quoted: msg }
      );
    }

    try {
      // =========================
      // OBTENER INFORMACIÓN
      // =========================
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];

      // =========================
      // IDENTIFICAR USUARIO
      // =========================
      const senderId =
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid;

      const sender = participants.find(p =>
        p.id && senderId && areJidsSameUser(p.id, senderId)
      );

      // =========================
      // VERIFICAR ADMIN
      // =========================
      if (!sender || !['admin', 'superadmin'].includes(sender.admin)) {
        return sock.sendMessage(
          chatId,
          {
            text: '❌ Solo los administradores pueden configurar las bienvenidas.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // CONFIGURACIÓN
      // =========================
      // Cambia estas variables por tu sistema
      const config = {
        welcome: true,
        welcomeMessage:
          '╭─〔 🫧 BIENVENIDO/A 〕─╮\n\n' +
          '👤 @user\n' +
          '🫧 Bienvenido/a a @grupo\n\n' +
          '👥 Miembros: @total\n\n' +
          '📜 @desc\n\n' +
          '╰────────────────╯',

        byeMessage:
          '╭─〔 🫧 DESPEDIDA 〕─╮\n\n' +
          '👤 @user\n' +
          'ha salido de @grupo.\n\n' +
          '👥 Miembros restantes: @total\n\n' +
          '╰────────────────╯'
      };

      const command = (args?.[0] || '').toLowerCase();
      const message = args?.slice(1).join(' ').trim();

      // =========================
      // .WELCOME
      // =========================
      if (command === 'on') {
        config.welcome = true;

        return sock.sendMessage(
          chatId,
          {
            text:
              '🫧 *BIENVENIDAS ACTIVADAS*\n\n' +
              '✅ El sistema de bienvenida está activado.'
          },
          { quoted: msg }
        );
      }

      if (command === 'off') {
        config.welcome = false;

        return sock.sendMessage(
          chatId,
          {
            text:
              '🫧 *BIENVENIDAS DESACTIVADAS*\n\n' +
              '❌ El sistema de bienvenida está desactivado.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // .SETWELCOME
      // =========================
      if (['setwelcome', 'setbienvenida'].includes(command)) {
        if (!message) {
          return sock.sendMessage(
            chatId,
            {
              text:
                '❌ Debes escribir el mensaje.\n\n' +
                'Ejemplo:\n' +
                '.setwelcome 🫧 Bienvenido @user a @grupo'
            },
            { quoted: msg }
          );
        }

        config.welcomeMessage = message;

        return sock.sendMessage(
          chatId,
          {
            text:
              '✅ *BIENVENIDA ACTUALIZADA*\n\n' +
              'El nuevo mensaje de bienvenida ha sido configurado.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // .SETBYE
      // =========================
      if (['setbye', 'setdespedida'].includes(command)) {
        if (!message) {
          return sock.sendMessage(
            chatId,
            {
              text:
                '❌ Debes escribir el mensaje.\n\n' +
                'Ejemplo:\n' +
                '.setbye 👋 @user salió de @grupo'
            },
            { quoted: msg }
          );
        }

        config.byeMessage = message;

        return sock.sendMessage(
          chatId,
          {
            text:
              '✅ *DESPEDIDA ACTUALIZADA*\n\n' +
              'El nuevo mensaje de despedida ha sido configurado.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // .RESETWELCOME
      // =========================
      if (command === 'resetwelcome') {
        config.welcomeMessage =
          '╭─〔 🫧 BIENVENIDO/A 〕─╮\n\n' +
          '👤 @user\n' +
          '🫧 Bienvenido/a a @grupo\n\n' +
          '👥 Miembros: @total\n\n' +
          '📜 @desc\n\n' +
          '╰────────────────╯';

        return sock.sendMessage(
          chatId,
          {
            text: '♻️ Mensaje de bienvenida restaurado correctamente.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // .RESETBYE
      // =========================
      if (command === 'resetbye') {
        config.byeMessage =
          '╭─〔 🫧 DESPEDIDA 〕─╮\n\n' +
          '👤 @user\n' +
          'ha salido de @grupo.\n\n' +
          '👥 Miembros restantes: @total\n\n' +
          '╰────────────────╯';

        return sock.sendMessage(
          chatId,
          {
            text: '♻️ Mensaje de despedida restaurado correctamente.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // .VERWELCOME
      // =========================
      if (command === 'verwelcome') {
        return sock.sendMessage(
          chatId,
          {
            text:
              `ꕥ *CONFIGURACIÓN DE BIENVENIDAS*\n\n` +

              `〄 *Estado actual:*\n` +
              `> Bienvenidas: *${config.welcome ? 'Activado' : 'Desactivado'}*\n` +
              `> Mensaje bienvenida:\n` +
              `_${config.welcomeMessage}_\n\n` +

              `> Mensaje despedida:\n` +
              `_${config.byeMessage}_\n\n` +

              `✐ *Comandos disponibles:*\n\n` +
              `> *.welcome on* — Activar bienvenidas\n` +
              `> *.welcome off* — Desactivar bienvenidas\n\n` +

              `> *.setwelcome <mensaje>* — Configurar bienvenida\n` +
              `> *.setbye <mensaje>* — Configurar despedida\n\n` +

              `> *.resetwelcome* — Restaurar bienvenida\n` +
              `> *.resetbye* — Restaurar despedida\n\n` +

              `> *.verwelcome* — Ver configuración completa\n\n` +

              `〄 *Variables disponibles:*\n` +
              `> *@user* — Menciona al usuario\n` +
              `> *@grupo* — Nombre del grupo\n` +
              `> *@total* — Total de miembros\n` +
              `> *@desc* — Descripción del grupo`
          },
          { quoted: msg }
        );
      }

      // =========================
      // AYUDA
      // =========================
      return sock.sendMessage(
        chatId,
        {
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
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error('[WELCOME ERROR]', error);

      return sock.sendMessage(
        chatId,
        {
          text:
            `❌ Ocurrió un error al configurar las bienvenidas.\n\n` +
            `> ${error?.message || error}`
        },
        { quoted: msg }
      );
    }
  }
};