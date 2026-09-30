export default {
  command: ['ping'],
  category: 'general',
  description: 'Muestra la velocidad de respuesta del bot',

  async execute(sock, m, args) {
    const inicio = Date.now()

    await sock.sendMessage(m.key.remoteJid, {
      text: '🏓 Calculando...'
    })

    const ms = Date.now() - inicio

    await sock.sendMessage(m.key.remoteJid, {
      text: `🏓 Pong!\n⚡ ${ms} ms`
    })
  }
}