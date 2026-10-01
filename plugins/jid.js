export default {
  command: ['jid'],
  category: 'group',
  description: 'Obtiene la JID de un usuario mencionado',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ Este comando solo puede usarse en grupos.'
      }, { quoted: msg });
    }

    const mentioned =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!mentioned.length) {
      const senderId = msg.key.participant || msg.key.remoteJid;

      return sock.sendMessage(chatId, {
        text: `📌 𝙏𝙪 𝙅𝙄𝘿:\n\n${senderId}`
      }, { quoted: msg });
    }

    const jid = mentioned[0];

    await sock.sendMessage(chatId, {
      text: `📌 𝙅𝙄𝘿 𝙤𝙗𝙩𝙚𝙣𝙞𝙙𝙖:\n\n${jid}`
    }, { quoted: msg });
  }
};