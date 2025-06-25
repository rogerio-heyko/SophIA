// logger.js - Sistema de logging para SophIA
const axios = require('axios');

// URL do frontend para envio de logs
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://frontend:3000';

/**
 * Função para enviar logs para o frontend
 * @param {string} tipo - Tipo do log (analise, ordem, monitorar)
 * @param {string} mensagem - Mensagem do log
 */
async function log(tipo, mensagem) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${mensagem}`;
    
    // Log no console
    console.log(`[${tipo.toUpperCase()}] ${logMessage}`);
    
    try {
        // Envia para o frontend via POST
        await axios.post(`${FRONTEND_URL}/log/${tipo}`, {
            mensagem: logMessage
        }, {
            timeout: 5000
        });
    } catch (error) {
        console.error(`Erro ao enviar log para frontend: ${error.message}`);
    }
}

module.exports = log;
