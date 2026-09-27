import { sendButtons, sendMenu } from "@whiskeysockets/baileys";

export default {
  command: ['botones'],
  category: 'tools',
  description: 'Prueba el sistema de botones (Nivel 1) de Noth Bails',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    await sendButtons(
      sock,
      chatId,
      {
        title: 'Noth Bails',
        body: 'Prueba del sistema de botones (Nivel 1)',
        footer: 'Powered by Noth',
        buttons: [
          { type: 'reply', text: 'Responder', id: 'test_reply' },
          { type: 'url', text: 'GitHub', url: 'https://github.com/Matthieu-x/noth-bails' }
        ]
      },
      msg
    );
  }
};
