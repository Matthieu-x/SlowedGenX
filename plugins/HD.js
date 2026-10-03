import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  command: ["hd"],
  category: "tools",
  description: "Mejora la calidad de una imagen",

  run: async (sock, msg, args, context) => {
    const { chatId } = context;

    try {
      const quoted =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted?.imageMessage) {
        return sock.sendMessage(
          chatId,
          {
            text: "❌ Responde a una imagen con:\n\n.hd"
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        chatId,
        {
          text: "✨ Mejorando imagen a HD..."
        },
        { quoted: msg }
      );

      const imageMsg = {
        key: {
          remoteJid: chatId,
          fromMe: false,
          id:
            msg.message?.extendedTextMessage?.contextInfo?.stanzaId ||
            msg.key.id
        },
        message: quoted
      };

      const buffer = await downloadMediaMessage(
        imageMsg,
        "buffer",
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      const metadata = await sharp(buffer).metadata();

      const anchoOriginal = metadata.width || 1000;
      const altoOriginal = metadata.height || 1000;

      const factor = 2;

      const resultado = await sharp(buffer)
        .resize({
          width: Math.min(anchoOriginal * factor, 4096),
          height: Math.min(altoOriginal * factor, 4096),
          fit: "inside",
          kernel: sharp.kernel.lanczos3
        })
        .sharpen({
          sigma: 1.2,
          m1: 1,
          m2: 2
        })
        .jpeg({
          quality: 95,
          chromaSubsampling: "4:4:4"
        })
        .toBuffer();

      await sock.sendMessage(
        chatId,
        {
          image: resultado,
          caption: "✨ *Imagen mejorada a HD*"
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error("[HD ERROR]", error);

      await sock.sendMessage(
        chatId,
        {
          text: "❌ No pude procesar la imagen."
        },
        { quoted: msg }
      );
    }
  }
};
