import { execSync } from "child_process";
import { config } from "../config.js";

const soloNumero = (valor) => String(valor || "").replace(/\D/g, "");

const esOwner = async (sock, sender) => {
  let jid = sender;

  try {
    const resuelto = await sock.resolveLidToJid(sender);
    if (resuelto) jid = resuelto;
  } catch {}

  const numeroSender = soloNumero(jid);
  if (!numeroSender) return false;

  return (config.owners || []).some((o) => soloNumero(o) === numeroSender);
};

export default {
  command: ["update", "actualizar", "gitpull"],
  category: "owner",
  description: "Actualiza el bot desde GitHub y reinicia con PM2",
  run: async (sock, msg, args, context) => {
    const { chatId, sender } = context;

    if (!(await esOwner(sock, sender))) {
      await sock.sendMessage(chatId, { text: "No tenés permiso para usar este comando." }, { quoted: msg });
      return;
    }

    try {
      await sock.sendMessage(chatId, { text: "Actualizando..." }, { quoted: msg });

      const antes = execSync("git rev-parse HEAD").toString().trim();
      const pull = execSync("git pull").toString();

      if (pull.includes("Already up to date")) {
        await sock.sendMessage(chatId, { text: "Ya está actualizado." }, { quoted: msg });
        return;
      }

      const despues = execSync("git rev-parse HEAD").toString().trim();
      const cambios = execSync(`git diff --name-only ${antes} ${despues}`)
        .toString().trim().split("\n").filter(Boolean);

      await sock.sendMessage(chatId, {
        text: `✅ Actualizado correctamente.\n` +
              `${antes.slice(0, 7)} → ${despues.slice(0, 7)}\n` +
              `${cambios.length} archivos cambiados.\n\n` +
              `🔄 Reiniciando aplicación con PM2...`
      }, { quoted: msg });

      await new Promise(resolve => setTimeout(resolve, 2000));

      execSync("pm2 restart 0");

    } catch (err) {
      await sock.sendMessage(chatId, { text: "⚠️ Error durante la actualización:\n" + err.message }, { quoted: msg });
    }
  },
};