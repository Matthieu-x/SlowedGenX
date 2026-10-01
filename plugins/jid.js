export default {
  command: ['jid'],
  category: 'tools',
  description: 'Obtiene el JID de un Newsletter',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const jid = msg.key?.remoteJid;

    if (!jid || !jid.endsWith('@newsletter')) {
      return sock.sendMessage(chatId, {
        text: '❌ Este comando debe ejecutarse desde un mensaje de un Newsletter.'
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `📌 𝙅𝙄𝘿 𝙉𝙚𝙬𝙨𝙡𝙚𝙩𝙩𝙚𝙧\n\n${jid}`
    }, { quoted: msg });
  }
};