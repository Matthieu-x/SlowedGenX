const spamData = new Map();

export default {
  command: ['antispam'],
  category: 'group',
  description: 'Activa o desactiva el sistema anti-spam',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    // =========================
    // SOLO GRUPOS
    // =========================
    if (!chatId?.endsWith('@g.us')) {
      return sock.sendMessage(
        chatId,
        {
          text: '🛡️ Este comando solo puede usarse en grupos.'
        },
        { quoted: msg }
      );
    }

    try {
      // =========================
      // INFORMACIÓN DEL GRUPO
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
        p.id &&
        senderId &&
        p.id === senderId
      );

      // =========================
      // VERIFICAR ADMIN
      // =========================
      if (!sender || !['admin', 'superadmin'].includes(sender.admin)) {
        return sock.sendMessage(
          chatId,
          {
            text: '❌ Solo los administradores pueden configurar el anti-spam.'
          },
          { quoted: msg }
        );
      }

      // =========================
      // ARGUMENTO
      // =========================
      const option = args[0]?.toLowerCase();

      if (!['on', 'off'].includes(option)) {
        const estado = spamData.get(chatId)?.enabled
          ? '🟢 Activado'
          : '🔴 Desactivado';

        return sock.sendMessage(
          chatId,
          {
            text:
              `🛡️ 𝘼𝙣𝙩𝙞-𝙎𝙥𝙖𝙢\n\n` +
              `Estado actual: ${estado}\n\n` +
              `Uso:\n` +
              `• antispam on\n` +
              `• antispam off`
          },
          { quoted: msg }
        );
      }

      // =========================
      // ACTIVAR
      // =========================
      if (option === 'on') {
        spamData.set(chatId, {
          enabled: true,
          users: new Map()
        });

        return sock.sendMessage(
          chatId,
          {
            text:
              `🛡️ 𝘼𝙣𝙩𝙞-𝙎𝙥𝙖𝙢\n\n` +
              `✅ Anti-spam activado.\n\n` +
              `⚡ El sistema comenzará a detectar mensajes repetitivos.`
          },
          { quoted: msg }
        );
      }

      // =========================
      // DESACTIVAR
      // =========================
      if (option === 'off') {
        spamData.delete(chatId);

        return sock.sendMessage(
          chatId,
          {
            text:
              `🛡️ 𝘼𝙣𝙩𝙞-𝙎𝙥𝙖𝙢\n\n` +
              `🔴 Anti-spam desactivado.`
          },
          { quoted: msg }
        );
      }

    } catch (error) {
      console.error('[ANTISPAM ERROR]', error);

      return sock.sendMessage(
        chatId,
        {
          text:
            `❌ Ocurrió un error al configurar el anti-spam.\n\n` +
            `> ${error?.message || error}`
        },
        { quoted: msg }
      );
    }
  }
};