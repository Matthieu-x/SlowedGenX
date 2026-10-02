export default {
  command: ['ping'],
  category: 'tools',
  description: 'Muestra la latencia del bot',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const start = Date.now();

    const sent = await sock.sendMessage(
      chatId,
      {
        text: 'ꕥ Pong'
      },
      { quoted: msg }
    );

    const latency = Date.now() - start;

    await sock.sendMessage(
      chatId,
      {
        text: `〄 Latencia: ${latency} ms`
      },
      { quoted: sent }
    );
  }
};