import { config } from "../config.js";

export default {
  command: ["owner"],
  category: "main",
  description: "Muestra información del creador",

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    const numero = String(config.ownerNumber || "")
      .replace(/\D/g, "");

    if (!numero) {
      return sock.sendMessage(
        chatId,
        {
          text: "❌ No hay un número de creador configurado."
        },
        {
          quoted: msg
        }
      );
    }

    await sock.sendMessage(
      chatId,
      {
        text:
          `👑 *Mi creador es Jhon Dzn* 🐇\n\n` +
          `📱 *Número:* +${numero}`
      },
      {
        quoted: msg
      }
    );
  }
};