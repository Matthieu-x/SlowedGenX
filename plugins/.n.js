export default {
  command: ['n'],
  category: 'group',
  description: 'Menciona a todos los miembros del grupo',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: '❌ Este comando solo puede usarse en grupos.'
      }, { quoted: msg });
    }

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants;

    const texto = args.join(' ');

    if (!texto) {
      return sock.sendMessage(chatId, {
        text: '❌ Escribe un mensaje.\n\nEjemplo: .n Hola a todos 👋'
      }, { quoted: msg });
    }

    const mentions = participants.map(p => p.id);

    await sock.sendMessage(chatId, {
      text: texto,
      mentions
    }, { quoted: msg });
  }
};