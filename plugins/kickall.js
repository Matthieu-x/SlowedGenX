import { areJidsSameUser } from '@whiskeysockets/baileys';

export default {
  command: ['kickall'],
  category: 'group',
  description: 'Elimina a todos los miembros excepto administradores',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    // Solo grupos
    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(
        chatId,
        {
          text: '🔪 Este comando solo puede usarse en grupos.'
        },
        { quoted: msg }
      );
    }

    try {
      // Obtener información del grupo
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];

      // =========================
      // IDENTIFICAR AL USUARIO
      // =========================
      const senderId =
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid;

      const sender = participants.find(p =>
        p.id && senderId && areJidsSameUser(p.id, senderId)
      );

      // Verificar administrador que ejecuta
      if (!sender || !['admin', 'superadmin'].includes(sender.admin)) {
        return sock.sendMessage(
          chatId,
          {
            text: '❌ Solo los administradores pueden usar este comando.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // IDENTIFICAR AL BOT
      // =========================
      const botIds = [
        sock.user?.id,
        sock.user?.lid
      ].filter(Boolean);

      const bot = participants.find(p =>
        p.id &&
        botIds.some(botId => areJidsSameUser(p.id, botId))
      );

      // Verificar administrador del bot
      if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
        return sock.sendMessage(
          chatId,
          {
            text: '❌ Necesito ser administrador para ejecutar este comando.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // SELECCIONAR MIEMBROS
      // =========================
      const targets = participants
        .filter(p => !['admin', 'superadmin'].includes(p.admin))
        .map(p => p.id)
        .filter(Boolean);

      if (!targets.length) {
        return sock.sendMessage(
          chatId,
          {
            text: '☠️ No hay miembros para eliminar. Los administradores permanecerán.'
          },
          { quoted: msg }
        );
      }

      // Aviso
      await sock.sendMessage(
        chatId,
        {
          text:
            `☠︎ 𝙆𝙞𝙘𝙠 𝘼𝙡𝙡\n\n` +
            `Eliminando ${targets.length} miembro(s)...\n\n` +
            `✦ Los administradores permanecerán en el grupo.`
        },
        { quoted: msg }
      );

      // =========================
      // ELIMINAR
      // =========================
      const result = await sock.groupParticipantsUpdate(
        chatId,
        targets,
        'remove'
      );

      console.log('[KICKALL] Resultado:', result);

      // Resultado
      await sock.sendMessage(chatId, {
        text:
          `✅ 𝙆𝙞𝙘𝙠 𝘼𝙡𝙡 𝙛𝙞𝙣𝙖𝙡𝙞𝙯𝙖𝙙𝙤.\n\n` +
          `☠︎ Intentados: ${targets.length}\n` +
          `🛡️ Administradores conservados.`
      });

    } catch (error) {
      console.error('[KICKALL ERROR]', error);

      await sock.sendMessage(
        chatId,
        {
          text:
            `❌ Ocurrió un error al ejecutar Kickall.\n\n` +
            `> ${error?.message || error}`
        },
        { quoted: msg }
      );
    }
  }
};