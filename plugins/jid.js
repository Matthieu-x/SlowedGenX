export default {
  command: ['jid'],
  category: 'tools',
  description: 'Obtiene el JID de un Newsletter',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo;

    // Buscar el JID del mensaje citado
    const quotedJid = contextInfo?.remoteJid;

    if (!quotedJid || !quotedJid.endsWith('@newsletter')) {
      return sock.sendMessage(chatId, {
        text: '🗣️ Responde directamente a una publicación del Newsletter y usa .jid'
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, {
      text: `📌 𝙏𝙪 𝙅𝙄𝘿 ♡\n\n${quotedJid}`
    }, { quoted: msg });
  }
};