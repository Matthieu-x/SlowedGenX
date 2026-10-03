import { execSync } from "child_process";
import { config } from "../config.js";

const soloNumero = (valor) =>
  String(valor || "").replace(/\D/g, "");

const esOwner = async (sock, sender, senderRaw) => {
  const identificadores = new Set();

  if (sender) {
    identificadores.add(String(sender));
  }

  if (senderRaw) {
    identificadores.add(String(senderRaw));
  }

  for (const identificador of [...identificadores]) {
    if (!identificador.endsWith("@lid")) continue;

    try {
      const resuelto =
        await sock.resolveLidToJid(identificador);

      if (resuelto) {
        identificadores.add(String(resuelto));
      }
    } catch {}
  }

  const numeros = new Set();

  for (const identificador of identificadores) {
    const numero = soloNumero(identificador);

    if (numero) {
      numeros.add(numero);
    }
  }

  if (!numeros.size) return false;

  return (config.owners || []).some((owner) => {
    const numeroOwner = soloNumero(owner);

    return numeroOwner && numeros.has(numeroOwner);
  });
};

export default {
  command: ["update", "actualizar", "gitpull"],
  category: "owner",
  description: "Actualiza el bot desde GitHub y reinicia con PM2",

  run: async (sock, msg, args, context) => {
    const {
      chatId,
      sender,
      senderRaw,
    } = context;

    if (!(await esOwner(sock, sender, senderRaw))) {
      await sock.sendMessage(
        chatId,
        {
          text: "No tenés permiso para usar este comando.",
        },
        {
          quoted: msg,
        }
      );

      return;
    }

    try {
      await sock.sendMessage(
        chatId,
        {
          text: "🔄 Actualizando desde GitHub...",
        },
        {
          quoted: msg,
        }
      );

      const antes = execSync("git rev-parse HEAD")
        .toString()
        .trim();

      // Descargar cambios del repositorio
      execSync("git fetch origin main", {
        stdio: "pipe",
      });

      // Actualizar conservando los commits locales
      const pull = execSync(
        "git pull --rebase origin main"
      ).toString();

      const despues = execSync("git rev-parse HEAD")
        .toString()
        .trim();

      if (antes === despues) {
        await sock.sendMessage(
          chatId,
          {
            text: "✅ Ya está actualizado.\n\nNo hay cambios nuevos en GitHub.",
          },
          {
            quoted: msg,
          }
        );

        return;
      }

      const cambios = execSync(
        `git diff --name-only ${antes} ${despues}`
      )
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean);

      await sock.sendMessage(
        chatId,
        {
          text:
            `✅ Actualizado correctamente.\n\n` +
            `${antes.slice(0, 7)} → ${despues.slice(0, 7)}\n` +
            `${cambios.length} archivos cambiados.\n\n` +
            `🔄 Reiniciando aplicación con PM2...`,
        },
        {
          quoted: msg,
        }
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      execSync("pm2 restart 0");

    } catch (err) {
      let error = err?.message || String(err);

      if (
        error.includes("CONFLICT") ||
        error.includes("could not apply")
      ) {
        error =
          "Git encontró un conflicto al combinar los cambios.\n\n" +
          "No se reinició el bot para evitar perder archivos.";
      }

      await sock.sendMessage(
        chatId,
        {
          text:
            "⚠️ Error durante la actualización:\n\n" +
            error,
        },
        {
          quoted: msg,
        }
      );
    }
  },
};