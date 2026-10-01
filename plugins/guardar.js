import fs from 'fs';

export default {
  command: ['guardar', 'save'],
  category: 'tools',
  description: 'Guarda información del usuario',

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    if (!args.length) {
      return await sock.sendMessage(chatId, {
        text: '❌ Uso: !guardar <clave> <valor>\n\nEjemplo:\n!guardar nombre Juan'
      }, { quoted: msg });
    }

    const clave = args[0];
    const valor = args.slice(1).join(' ');

    if (!valor) {
      return await sock.sendMessage(chatId, {
        text: `❌ Debes indicar un valor.\n\nEjemplo:\n!guardar ${clave} Juan`
      }, { quoted: msg });
    }

    const archivo = './database.json';

    let database = {};

    if (fs.existsSync(archivo)) {
      database = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    }

    if (!database[chatId]) {
      database[chatId] = {};
    }

    database[chatId][clave] = valor;

    fs.writeFileSync(
      archivo,
      JSON.stringify(database, null, 2)
    );

    await sock.sendMessage(chatId, {
      text: `✅ Información guardada.\n\n🔑 Clave: ${clave}\n📝 Valor: ${valor}`
    }, { quoted: msg });
  }
};