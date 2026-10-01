export const config = {
  botName: "SlowedGenX",
  version: "1.0.0",
  creator: "Duan & Jhon",
  sessionFolder: "./sessions/main",
  subBotsFolder: "./sessions/subbots",
  ownerNumber: "50497305037",
  owners: [
    "50497305037",     // número real del owner 1
    "504XXXXXXXX",     // número real del owner 2
  ],
  canal: null,

  welcome: {
    mensajeBienvenida: "Hola, *${mention}* Bienvenida/o a {grupo}. Ya somos {cantidad}.",
    mensajeDespedida: "${mention}* se fue de {grupo}. Ya somos {cantidad}.",
  },
};