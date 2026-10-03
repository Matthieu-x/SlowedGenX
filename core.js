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
 * PREFIJO POR DEFECTO
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
          `[${etiqueta}] Se agotaron los intentos para pedir el código de vinculación. Probá desde otra red.`
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
        err.message
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
   * CONEXIÓN
   * ========================================================== */

  sock.ev.on(
    "connection.update",
    (update)