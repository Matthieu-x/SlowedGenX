export default {
  command: ['ping'],
  category: 'tools',
  description: 'Muestra la latencia del bot',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const start = Date.now();

    await sock.sendMessage(
      chatId,
      {
        text: '🏓 𝙋𝙤𝙣𝙜...'
      },
      { quoted: msg }
    );

    const ping = Date.now() - start;

    await sock.sendMessage(
      chatId,
      {
        text: `🏓 𝙋𝙤𝙣𝙜!\n\n⚡ 𝙇𝙖𝙩𝙚𝙣𝙘𝙞𝙖: ${ping} ms`
      },
      { quoted: msg }
    );
  }
};