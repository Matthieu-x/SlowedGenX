export default {
  command: ['debug', 'debuginfo'],
  category: 'tools',
  description: 'Muestra información de depuración del mensaje',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const debugInfo = {
      chatId,
      messageId: msg?.key?.id || 'No disponible',
      fromMe: msg?.key?.fromMe || false,
      participant: msg?.key?.participant || 'No disponible',
      type: msg?.message
        ? Object.keys(msg.message)[0]
        : 'No disponible',
      args: args || []
    };

    await sock.sendMessage(
      chatId,
      {
        text: `🐛 *DEBUG INFO*\n\n` +
          `💬 Chat ID: ${debugInfo.chatId}\n` +
          `🆔 Message ID: ${debugInfo.messageId}\n` +
          `👤 Participant: ${debugInfo.participant}\n` +
          `📨 From Me: ${debugInfo.fromMe}\n` +
          `📦 Type: ${debugInfo.type}\n` +
          `🔧 Args: ${debugInfo.args.join(' ') || 'Ninguno'}`
      },
      { quoted: msg }
    );
  }
};