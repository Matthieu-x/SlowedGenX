import { sendMenu } from "@whiskeysockets/baileys";

export default {
  command: ['menu2'],
  category: 'tools',
  description: 'Prueba la lista/menu interactivo (Nivel 1) de Noth Bails',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    await sendMenu(
      sock,
      chatId,
      {
        title: 'Noth Bails',
        body: 'Prueba de la lista/menu interactivo',
        footer: 'Powered by Noth',
        buttonText: 'Abrir menu',
        sections: [
          {
            title: 'Pruebas',
            rows: [
              { title: 'Opcion 1', description: 'Primera fila', id: 'opt_1' },
              { title: 'Opcion 2', description: 'Segunda fila', id: 'opt_2' }
            ]
          }
        ]
      },
      msg
    );
  }
};
