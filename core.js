import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
import pino from "pino";
import chalk from "chalk";
import fs from "fs";

import { manejarCambioAdmin } from "./adminEvents.js";

import {
  enviarWelcome,
  enviarBye
} from "./plugins/welcome.js";

/* ============================================================
 * PREFIJO
 * ============================================================ */

export const PREFIX = ".";


/* ============================================================
 * PAIRING
 * ============================================================ */

async function pedirCodigoPairing(
  sock,
  numero,
  onPairingCode,
  etiqueta,
  intento = 1
) {

  const MAX_INTENTOS = 4;
  const ESPERA_INICIAL = 3000;

  if (intento === 1) {
    await new Promise((r) =>
      setTimeout(r, ESPERA_INICIAL)
    );
  }

  try {

    const code =
      await sock.requestPairingCode(
        numero.trim()
      );

    onPairingCode(code);

  } catch (err) {

    console.log(
      chalk.red(
        `[${etiqueta}] Error pidiendo código ` +
        `(intento ${intento}/${MAX_INTENTOS}):`
      ),
      err?.message || err
    );

    if (intento < MAX_INTENTOS) {

      const espera =
        1500 * intento;

      await new Promise((r) =>
        setTimeout(r, espera)
      );

      await pedirCodigoPairing(
        sock,
        numero,
        onPairingCode,
        etiqueta,
        intento + 1
      );

    } else {

      console.log(
        chalk.red(
          `[${etiqueta}] Se agotaron los intentos para pedir el código de vinculación.`
        )
      );
    }
  }
}


/* ============================================================
 * BOTONES
 * ============================================================ */

function extraerRespuestaBoton(message) {

  const nativeFlow =
    message?.interactiveResponseMessage
      ?.nativeFlowResponseMessage;

  if (!nativeFlow?.paramsJson) {
    return null;
  }

  try {

    const params =
      JSON.parse(
        nativeFlow.paramsJson
      );

    if (params.id) {
      return params.id;
    }

    if (params.list_item?.id) {
      return params.list_item.id;
    }

    return null;

  } catch {

    return null;
  }
}


/* ============================================================
 * CREAR BOT
 * ============================================================ */

export async function crearBot({

  sessionFolder,

  etiqueta = "BOT",

  mostrarQR = false,

  numeroParaPairing = null,

  onPairingCode = null,

  onReady = null,

  onLoggedOut = null,

  isSubBot = false,

  onSock = null,

  onMessage = null,

  onGroupParticipantsUpdate = null,

  onGroupsUpdate = null,

}) {

  /* ==========================================================
   * CACHE DE GRUPOS
   * ========================================================== */

  const groupMetadataCache =
    new Map();


  fs.mkdirSync(
    sessionFolder,
    {
      recursive: true
    }
  );


  /* ==========================================================
   * AUTENTICACIÓN
   * ========================================================== */

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      sessionFolder
    );


  let ultimoGuardado =
    Promise.resolve();


  const { version } =
    await fetchLatestBaileysVersion();


  const yaRegistrado =
    fs.existsSync(
      `${sessionFolder}/creds.json`
    );


  /* ==========================================================
   * SOCKET
   * ========================================================== */

  const sock =
    makeWASocket({

      version,

      auth: state,

      printQRInTerminal:
        mostrarQR && !yaRegistrado,

      browser:
        Browsers.ubuntu("Chrome"),

      logger:
        pino({
          level: "silent",
        }),

      syncFullHistory: false,

      cachedGroupMetadata:
        async (jid) =>
          groupMetadataCache.get(jid),

    });


  sock.prefix =
    PREFIX;


  if (onSock) {
    onSock(sock);
  }


  /* ==========================================================
   * MENSAJES ENVIADOS POR EL BOT
   * ========================================================== */

  const idsPropiosEnviados =
    new Set();


  const enviarOriginal =
    sock.sendMessage.bind(sock);


  sock.sendMessage =
    async (...params) => {

      const resultado =
        await enviarOriginal(
          ...params
        );


      if (resultado?.key?.id) {

        idsPropiosEnviados.add(
          resultado.key.id
        );


        if (
          idsPropiosEnviados.size > 500
        ) {

          idsPropiosEnviados.delete(
            idsPropiosEnviados
              .values()
              .next()
              .value
          );
        }
      }


      return resultado;
    };


  /* ============================================================
   * CACHE DE GRUPO
   * ============================================================ */

  async function actualizarCacheGrupo(
    chatId
  ) {

    try {

      const metadata =
        await sock.groupMetadata(
          chatId
        );


      groupMetadataCache.set(
        chatId,
        metadata
      );


      return metadata;

    } catch (err) {

      console.log(
        chalk.red(
          `[${etiqueta}] Error obteniendo metadata de grupo ${chatId}:`
        ),
        err?.message || err
      );


      return (
        groupMetadataCache.get(
          chatId
        ) || null
      );
    }
  }


  sock.groupMetadataCache =
    groupMetadataCache;


  sock.actualizarCacheGrupo =
    actualizarCacheGrupo;


  /* ============================================================
   * CONTACTOS
   * ============================================================ */

  sock.contacts = {};


  sock.ev.on(
    "contacts.upsert",
    (contactos) => {

      for (const c of contactos) {

        sock.contacts[c.id] =
          c;
      }
    }
  );


  sock.ev.on(
    "contacts.update",
    (actualizaciones) => {

      for (const act of actualizaciones) {

        if (
          sock.contacts[act.id]
        ) {

          Object.assign(
            sock.contacts[act.id],
            act
          );

        } else {

          sock.contacts[act.id] =
            act;
        }
      }
    }
  );


  /* ============================================================
   * GUARDAR CREDENCIALES
   * ============================================================ */

  sock.ev.on(
    "creds.update",
    async () => {

      ultimoGuardado =
        ultimoGuardado
          .then(() => saveCreds())
          .catch(() => {});

      await ultimoGuardado;
    }
  );


  /* ============================================================
   * PAIRING
   * ============================================================ */

  if (
    !yaRegistrado &&
    numeroParaPairing &&
    onPairingCode
  ) {

    pedirCodigoPairing(
      sock,
      numeroParaPairing,
      onPairingCode,
      etiqueta
    );
  }


  /* ============================================================
   * EVENTOS DE PARTICIPANTES
   * ============================================================ */

  sock.ev.on(
    "group-participants.update",
    async (update) => {

      try {

        const metadata =
          await actualizarCacheGrupo(
            update.id
          );


        /* ======================================================
         * BIENVENIDA
         * ====================================================== */

        if (
          update.action === "add"
        ) {

          await enviarWelcome(
            sock,
            update
          );
        }


        /* ======================================================
         * DESPEDIDA
         * ====================================================== */

        if (
          update.action === "remove" ||
          update.action === "leave"
        ) {

          await enviarBye(
            sock,
            update
          );
        }


        /* ======================================================
         * EVENTOS DE ADMIN
         * ====================================================== */

        if (
          update.action === "promote" ||
          update.action === "demote"
        ) {

          await manejarCambioAdmin(
            sock,
            update,
            metadata
          );
        }


        /* ======================================================
         * CALLBACK EXTERNO
         * ====================================================== */

        if (onGroupParticipantsUpdate) {

          try {

            await onGroupParticipantsUpdate(
              sock,
              update,
              metadata
            );

          } catch (err) {

            console.log(
              chalk.red(
                `[${etiqueta}] Error en onGroupParticipantsUpdate:`
              ),
              err
            );
          }
        }

      } catch (err) {

        console.log(
          chalk.red(
            `[${etiqueta}] Error en group-participants.update:`
          ),
          err
        );
      }
    }
  );


  /* ============================================================
   * ACTUALIZACIÓN DE GRUPOS
   * ============================================================ */

  sock.ev.on(
    "groups.update",
    async (updates) => {

      for (const event of updates || []) {

        if (!event?.id) {
          continue;
        }


        const anterior =
          groupMetadataCache.get(
            event.id
          );


        if (onGroupsUpdate) {

          try {

            await onGroupsUpdate(
              sock,
              event,
              anterior
            );

          } catch (err) {

            console.log(
              chalk.red(
                `[${etiqueta}] Error en onGroupsUpdate:`
              ),
              err
            );
          }
        }


        await actualizarCacheGrupo(
          event.id
        );
      }
    }
  );


  /* ============================================================
   * MENSAJES
   * ============================================================ */

  sock.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }) => {

      if (type !== "notify") {
        return;
      }


      const msg =
        messages?.[0];


      if (!msg?.message) {
        return;
      }


      /* ========================================================
       * IGNORAR MENSAJES PROPIOS
       * ======================================================== */

      if (
        msg.key.fromMe &&
        idsPropiosEnviados.has(
          msg.key.id
        )
      ) {

        return;
      }


      const chatIdRaw =
        msg.key.remoteJid;


      const senderRaw =
        msg.key.participant ||
        msg.key.remoteJid;


      let chatId =
        chatIdRaw;


      let sender =
        senderRaw;


      /* ========================================================
       * RESOLVER LID DEL CHAT
       * ======================================================== */

      if (
        chatIdRaw &&
        chatIdRaw.endsWith("@lid")
      ) {

        try {

          const resuelto =
            await sock.resolveLidToJid(
              chatIdRaw
            );


          if (resuelto) {
            chatId = resuelto;
          }

        } catch (_) {}
      }


      /* ========================================================
       * RESOLVER LID DEL USUARIO
       * ======================================================== */

      if (
        senderRaw &&
        senderRaw.endsWith("@lid")
      ) {

        try {

          const resuelto =
            await sock.resolveLidToJid(
              senderRaw
            );


          if (resuelto) {
            sender = resuelto;
          }

        } catch (_) {}
      }


      /* ========================================================
       * OBTENER TEXTO
       * ======================================================== */

      const body =

        msg.message.conversation ||

        msg.message.extendedTextMessage?.text ||

        msg.message.imageMessage?.caption ||

        msg.message.videoMessage?.caption ||

        extraerRespuestaBoton(
          msg.message
        ) ||

        "";


      /* ========================================================
       * GRUPO
       * ======================================================== */

      const esGrupo =
        chatIdRaw?.endsWith("@g.us");


      /* ========================================================
       * LOG
       * ======================================================== */

      console.log(

        chalk.blueBright(

          `[${etiqueta}] ` +

          `${sender?.split("@")[0] || "desconocido"}` +

          `${esGrupo ? " (grupo)" : ""}: `

        ) +

        (
          body ||
          "(mensaje sin texto)"
        )
      );


      /* ========================================================
       * CALLBACK DE MENSAJE
       * ======================================================== */

      if (onMessage) {

        try {

          await onMessage(
            sock,
            msg,
            {
              chatId,

              chatIdRaw,

              sender,

              senderRaw,

              body,

              esGrupo,

              isSubBot,

              prefix: PREFIX,
            }
          );

        } catch (err) {

          console.log(
            chalk.red(
              `[${etiqueta}] Error en onMessage:`
            ),
            err
          );
        }
      }
    }
  );


  /* ============================================================
   * CONEXIÓN
   * ============================================================ */

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect
      } = update;


      /* ========================================================
       * CONECTADO
       * ======================================================== */

      if (connection === "open") {

        console.log(
          chalk.greenBright(
            `[${etiqueta}] ✓ Conectado correctamente.`
          )
        );


        if (onReady) {

          try {

            await onReady(
              sock
            );

          } catch (err) {

            console.log(
              chalk.red(
                `[${etiqueta}] Error en onReady:`
              ),
              err
            );
          }
        }
      }


      /* ========================================================
       * DESCONECTADO
       * ======================================================== */

      if (connection === "close") {

        const codigo =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;


        console.log(
          chalk.red(
            `[${etiqueta}] ✗ Conexión cerrada. Código: ${codigo}`
          )
        );


        /* ======================================================
         * SESIÓN CERRADA
         * ====================================================== */

        if (
          codigo ===
          DisconnectReason.loggedOut
        ) {

          console.log(
            chalk.red(
              `[${etiqueta}] La sesión fue cerrada.`
            )
          );


          if (onLoggedOut) {

            try {

              await onLoggedOut(
                sock
              );

            } catch (err) {

              console.log(
                chalk.red(
                  `[${etiqueta}] Error en onLoggedOut:`
                ),
                err
              );
            }
          }


          return;
        }


        /* ======================================================
         * OTROS ERRORES
         * ====================================================== */

        console.log(
          chalk.yellow(
            `[${etiqueta}] La conexión se cerró.`
          )
        );


        console.log(
          chalk.yellow(
            `[${etiqueta}] El sistema externo puede volver a crear el socket.`
          )
        );
      }
    }
  );


  return sock;
}