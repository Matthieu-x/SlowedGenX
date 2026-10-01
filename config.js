export const config = {
  botName: "SlowedGenX",
  version: "1.0.0",
  creator: "Duan & Jhon",

  sessionFolder: "./sessions/main",
  subBotsFolder: "./sessions/subbots",

  ownerNumber: "50375638328",

  owners: [
    "50375638328",            // Owner 1 - +503 7563-8328
    "26195676684428@lid",     // Owner 1 - LID

    "50497305037",            // Owner 2 - +504 9730-5037
    "205724672110753@lid",    // Owner 2 - LID
  ],

  canal: null,

  welcome: {
    mensajeBienvenida:
      "Hola, *${mention}* Bienvenida/o a {grupo}. Ya somos {cantidad}.",

    mensajeDespedida:
      "${mention}* se fue de {grupo}. Ya somos {cantidad}.",
  },
};