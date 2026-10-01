export default {
  command: ['jid'],
  category: 'tools',
  description: 'Obtiene el JID de un Newsletter',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const quoted =
      msg.message?.extendedTextMessage?.contextInfo;

    // JID del chat actual
    const currentJid = msg.key.remoteJid;

    // JID del mensaje citado
    const quotedJid = quoted?.remoteJid;

    const jid = quotedJid || currentJid;

    if (!jid) {
      return sock.sendMessage(chatId, {
        text: '❌ No pude obtener el JID.'
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `📌 𝙅𝙄𝘿 𝙉𝙚𝙬𝙨𝙡𝙚𝙩𝙩𝙚𝙧\n\n${jid}`
    }, { quoted: msg });
  }
};