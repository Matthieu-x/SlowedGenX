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

/* ============================================================
 * PREFIJO
 * ============================================================ */

export const PREFIX = ".";


/* ============================================================
 * BASE DE DATOS
 * ============================================================ */

const DATABASE_FILE = "./database.json";


function cargarDatabase() {
  try {
    if (!fs.existsSync(DATABASE_FILE)) {
      return {};
    }

    const contenido =
      fs.readFileSync(
        DATABASE_FILE,
        "utf8"
      );

    if (!contenido.trim()) {
      return {};
    }

    return JSON.parse(contenido);

  } catch (error) {
    console.error(
      "[CORE] Error leyendo database.json:",
      error
    );

    return {};
  }
}


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
 * PREPARAR MENSAJE DE WELCOME
 * ============================================================ */

function prepararMensajeWelcome(
  texto,
  usuario,
  metadata
) {

  const grupo =
    metadata?.subject ||
    "este grupo";

  const total =
    metadata?.participants?.length ||
    0;

  const desc =
    metadata?.desc ||
    "Sin descripción";

  return String(texto || "")
    .replace(
      /@user/g,
      `@${usuario.split("@")[0]}`
    )
    .replace(
      /@grupo/g,
      grupo
    )
    .replace(
      /@total/g,
      String(total)
    )
    .replace(
      /@desc/g,
      desc
    );
}


/* ============================================================
 * EVENTO DE BIENVENIDA / DESPEDIDA
 * ============================================================ */

async function manejarWelcome(
  sock,
  update,
  metadata,
  etiqueta
) {

  try {

    const chatId =
      update?.id;

    const participantes =
      update?.participants || [];

    const accion =
      update?.action;

    if (!chatId?.endsWith("@g.us")) {
      return;
    }

    if (!participantes.length) {
      return;
    }

    if (
      accion !== "add" &&
      accion !== "remove"
    ) {
      return;
    }


    /* ========================================================
     * LEER DATABASE
     * ======================================================== */

    const database =
      cargarDatabase();

    const config =
      database?.welcome?.[chatId];


    /*
     * Si el grupo nunca configuró nada,
     * no enviamos nada.
     */

    if (!config) {
      return;
    }


    /*
     * Si está desactivado tampoco enviamos.
     */

    if (config.enabled === false) {
      return;
    }


    /* ========================================================
     * MENSAJE
     * ======================================================== */

    const plantilla =
      accion === "add"
        ? config.welcomeMessage
        : config.byeMessage;


    if (!plantilla) {
      return;
    }


    /* ========================================================
     * ENVIAR A CADA PARTICIPANTE
     * ======================================================== */

    for (const participante of participantes) {

      const texto =
        prepararMensajeWelcome(
          plantilla,
          participante,
          metadata
        );


      await sock.sendMessage(
        chatId,
        {
          text,
          mentions: [
            participante
          ]
        }
      );
    }


    console.log(
      chalk.green(
        `[${etiqueta}] ${
          accion === "add"
            ? "WELCOME"
            : "BYE"
        } enviado en ${chatId}`
      )
    );

  } catch (error) {

    console.log(
      chalk.red(
        `[${etiqueta}] Error en welcome:`
      ),
      error
    );
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
   * GUARDAR CREDENCIALES
   * ========================================================== */

  sock.ev.on(
    "creds.update",
    saveCreds
  );


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


  /* ==========================================================
   * CACHE DE GRUPO
   * ========================================================== */

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


  /* ==========================================================
   * CONTACTOS
   * ========================================================== */

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


  /* ==========================================================
   * PAIRING
   * ========================================================== */

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


  /* ==========================================================
   * EVENTOS DE PARTICIPANTES
   * ========================================================== */

  sock.ev.on(
    "group-participants.update",
    async (update) => {

      const chatId =
        update?.id;

      if (!chatId?.endsWith("@g.us")) {
        return;
      }


      console.log(
        chalk.magenta(
          `[${etiqueta}] GROUP PARTICIPANTS:`
        ),
        update?.action,
        update?.participants
      );


      const metadata =
        await actualizarCacheGrupo(
          chatId
        );


      /*
       * WELCOME / BYE
       */

      await manejarWelcome(
        sock,
        update,
        metadata,
        etiqueta
      );


      /*
       * CALLBACK EXTERNO
       */

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


      /*
       * EVENTOS DE ADMIN
       */

      if (
        update.action === "promote" ||
        update.action === "demote"
      ) {

        try {

          await manejarCambioAdmin(
            sock,
            update,
            metadata
          );

        } catch (err) {

          console.log(
            chalk.red(
              `[${etiqueta}] Error en adminEvents:`
            ),
            err
          );
        }
      }
    }
  );


  /* ==========================================================
   * ACTUALIZACIÓN DE GRUPOS
   * ========================================================== */

  sock.ev.on(
    "groups.update",
    async (eventos) => {

      for (const event of eventos || []) {

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


  /* ==========================================================
   * MENSAJES
   * ========================================================== */

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }) => {

      if (type !== "notify") {
        return;
      }


      const msg =
        messages[0];


      if (!msg?.message) {
        return;
      }


      /*
       * Ignorar mensajes propios
       */

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


      /* ======================================================
       * RESOLVER LID DEL CHAT
       * ====================================================== */

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


      /* ======================================================
       * RESOLVER LID DEL USUARIO
       * ====================================================== */

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


      /* ======================================================
       * TEXTO
       * ====================================================== */

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        extraerRespuestaBoton(
          msg.message
        ) ||
        "";


      const esGrupo =
        chatIdRaw?.endsWith(
          "@g.us"
        );


      console.log(
        chalk.blueBright(
          `[${etiqueta}] ` +
          `${sender?.split("@")[0] || "?"}` +
          `${esGrupo ? " (grupo)" : ""}: `
        ) +
        (
          body ||
          "(mensaje sin texto)"
        )
      );


      /* ======================================================
       * ON MESSAGE
       * ====================================================== */

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


  /* ==========================================================
   * CONEXIÓN
   * ========================================================== */

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect
      } = update;


      if (
        connection === "open"
      ) {

        console.log(
          chalk.green(
            `[${etiqueta}] WhatsApp conectado.`
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


      if (
        connection === "close"
      ) {

        const statusCode =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;


        console.log(
          chalk.yellow(
            `[${etiqueta}] Conexión cerrada. Código: ${statusCode}`
          )
        );


        if (
          statusCode ===
          DisconnectReason.loggedOut
        ) {

          console.log(
            chalk.red(
              `[${etiqueta}] Sesión cerrada.`
            )
          );


          if (onLoggedOut) {

            try {
              await onLoggedOut();

            } catch (err) {

              console.log(
                chalk.red(
                  `[${etiqueta}] Error en onLoggedOut:`
                ),
                err
              );
            }
          }

        } else {

          console.log(
            chalk.yellow(
              `[${etiqueta}] Intentando reconectar...`
            )
          );
        }
      }
    }
  );


  return sock;
}